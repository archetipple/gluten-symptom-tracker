import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TrackerDB, ensureSeeded, exportAll, importAll } from '../db/db';
import { syncOnce, type Remote, type RemoteRow } from './engine';

/** In-memory cloud with the same rules as supabase/schema.sql. */
class FakeCloud implements Remote {
  rows = new Map<string, RemoteRow>();
  seq = 0;
  async push(rows: RemoteRow[]) {
    for (const r of rows) {
      const k = `${r.tbl}|${r.id}`;
      const cur = this.rows.get(k);
      if (cur && Date.parse(cur.updated_at) > Date.parse(r.updated_at)) continue; // newest wins
      this.rows.set(k, { ...structuredClone(r), seq: ++this.seq });
    }
  }
  async pull(after: number, limit: number) {
    return [...this.rows.values()].filter((r) => (r.seq ?? 0) > after).sort((a, b) => a.seq! - b.seq!).slice(0, limit).map((r) => structuredClone(r));
  }
}

const settle = () => new Promise((r) => setTimeout(r, 20)); // let outbox writes land

let n = 0;
async function device() {
  const d = new TrackerDB(`sync-${n++}`);
  await ensureSeeded(d);
  await settle();
  return d;
}

const symptom = (id: string) => ({ id, at: '2026-11-03T09:00', symptoms: [{ type: 'Bloating', severity: 5 }], notes: '' });

describe('cloud sync', () => {
  it("a second device gets the first device's data, not its own defaults", async () => {
    const cloud = new FakeCloud();
    const phone = await device();
    await phone.settings.update('settings', { windowHours: 72 });
    await phone.symptoms.put(symptom('s1'));
    await settle();
    await syncOnce(phone, cloud, 'me');

    const laptop = await device();
    const r = await syncOnce(laptop, cloud, 'me');
    expect(r.initial).toBe(true);
    expect((await laptop.settings.get('settings'))?.windowHours).toBe(72);
    expect(await laptop.symptoms.get('s1')).toBeTruthy();
    expect((cloud.rows.get('settings|settings')?.data as { windowHours: number }).windowHours).toBe(72);
  });

  it('changes and deletes flow both ways', async () => {
    const cloud = new FakeCloud();
    const a = await device();
    await syncOnce(a, cloud, 'me');
    const b = await device();
    await syncOnce(b, cloud, 'me');

    await a.symptoms.put(symptom('s2'));
    await settle();
    await syncOnce(a, cloud, 'me');
    await syncOnce(b, cloud, 'me');
    expect(await b.symptoms.get('s2')).toBeTruthy();

    await b.symptoms.delete('s2');
    await settle();
    await syncOnce(b, cloud, 'me');
    await syncOnce(a, cloud, 'me');
    expect(await a.symptoms.get('s2')).toBeUndefined();
    expect(await a.outbox.count()).toBe(0);
  });

  it('backup and restore round-trip', async () => {
    const a = await device();
    await a.symptoms.put(symptom('s3'));
    const backup = await exportAll(a);
    const b = await device();
    await importAll(backup, b);
    expect(await b.symptoms.get('s3')).toBeTruthy();
    expect(await b.outbox.get('symptoms|s3')).toBeTruthy();
  });
});
