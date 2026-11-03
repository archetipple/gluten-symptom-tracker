import type { Table, Transaction } from 'dexie';
import type { TrackerDB } from '../db/db';

/** Tables that never leave the device. */
export const LOCAL_ONLY = new Set(['outbox', 'syncMeta']);

export interface RemoteRow {
  tbl: string;
  id: string;
  data: unknown | null;
  deleted: boolean;
  updated_at: string;
  seq?: number;
}

/** The cloud side, kept behind an interface so it can be tested without a server. */
export interface Remote {
  push(rows: RemoteRow[]): Promise<void>;
  /** Rows with seq greater than `after`, ascending by seq. */
  pull(after: number, limit: number): Promise<RemoteRow[]>;
}

export interface OutboxEntry {
  key: string; // `${tbl}|${id}`
  tbl: string;
  id: string;
  updatedAt: string; // ISO, when the local change happened
  deleted: boolean;
}

export interface SyncState {
  key: 'state';
  userId: string;
  cursor: number;
  lastSync?: string;
}

const EPOCH = new Date(0).toISOString();
const keyOf = (tbl: string, id: string) => `${tbl}|${id}`;
const time = (iso: string) => Date.parse(iso);

export function syncedTables(d: TrackerDB): Table[] {
  return d.tables.filter((t) => !LOCAL_ONLY.has(t.name));
}

function primaryKey(t: Table, obj: unknown): string {
  const kp = t.schema.primKey.keyPath as string;
  return String((obj as Record<string, unknown>)[kp]);
}

type Tracked = Transaction & { __remote?: boolean; __changes?: OutboxEntry[] };

/**
 * Record every local create, update and delete in the outbox, once the
 * transaction that made it has committed. Changes applied from the cloud are
 * marked and skipped.
 */
export function installChangeTracking(d: TrackerDB, now: () => string = () => new Date().toISOString()): void {
  for (const t of syncedTables(d)) {
    const track = (trans: Tracked, id: unknown, deleted: boolean) => {
      if (trans.__remote || id === undefined) return;
      if (!trans.__changes) {
        trans.__changes = [];
        const list = trans.__changes;
        trans.on('complete', () => {
          // Last change per key wins within one transaction.
          const byKey = new Map(list.map((e) => [e.key, e]));
          d.outbox.bulkPut([...byKey.values()]).catch(() => undefined);
        });
      }
      const sid = String(id);
      trans.__changes.push({ key: keyOf(t.name, sid), tbl: t.name, id: sid, updatedAt: now(), deleted });
    };
    t.hook('creating', function (primKey, obj, trans) {
      track(trans as Tracked, primKey ?? primaryKey(t, obj), false);
    });
    t.hook('updating', function (_mods, primKey, _obj, trans) {
      track(trans as Tracked, primKey, false);
    });
    t.hook('deleting', function (primKey, _obj, trans) {
      track(trans as Tracked, primKey, true);
    });
  }
}

/** Queue every local record for upload (used after restoring a backup). */
export async function markAllForPush(d: TrackerDB, at: string = new Date().toISOString()): Promise<void> {
  const entries: OutboxEntry[] = [];
  for (const t of syncedTables(d)) {
    for (const obj of await t.toArray()) {
      const id = primaryKey(t, obj);
      entries.push({ key: keyOf(t.name, id), tbl: t.name, id, updatedAt: at, deleted: false });
    }
  }
  await d.outbox.bulkPut(entries);
}

async function pullAll(remote: Remote, after: number): Promise<RemoteRow[]> {
  const out: RemoteRow[] = [];
  let cursor = after;
  for (;;) {
    const page = await remote.pull(cursor, 1000);
    out.push(...page);
    if (page.length < 1000) break;
    cursor = Math.max(cursor, ...page.map((r) => r.seq ?? 0));
  }
  return out;
}

/** Write cloud rows into local tables without re-queuing them. */
async function applyRemote(d: TrackerDB, rows: RemoteRow[], respectOutbox: boolean): Promise<number> {
  if (!rows.length) return 0;
  const tables = syncedTables(d);
  const byName = new Map(tables.map((t) => [t.name, t]));
  let applied = 0;
  await d.transaction('rw', [...tables, d.outbox], async (tx) => {
    (tx as Tracked).__remote = true;
    for (const row of rows) {
      const t = byName.get(row.tbl);
      if (!t) continue; // a table this app version doesn't know yet
      if (respectOutbox) {
        const pending = await d.outbox.get(keyOf(row.tbl, row.id));
        if (pending && time(pending.updatedAt) > time(row.updated_at)) continue; // local is newer; it will be pushed
      }
      if (row.deleted || row.data == null) await t.delete(row.id);
      else await t.put(row.data);
      applied++;
    }
  });
  return applied;
}

async function rowsFor(d: TrackerDB, entries: OutboxEntry[]): Promise<RemoteRow[]> {
  const rows: RemoteRow[] = [];
  for (const e of entries) {
    const t = syncedTables(d).find((x) => x.name === e.tbl);
    const data = e.deleted || !t ? undefined : await t.get(e.id);
    rows.push({ tbl: e.tbl, id: e.id, data: data ?? null, deleted: data === undefined, updated_at: e.updatedAt });
  }
  return rows;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  initial: boolean;
}

/**
 * One sync round.
 * First sync on a device (or for a new account): download everything and let
 * the cloud win, then upload only what the cloud doesn't have, dated 1970 so
 * any real change elsewhere stays newer. This stops a fresh install's starter
 * data from overwriting your real data.
 * After that: upload queued changes, then download changes since last time.
 */
export async function syncOnce(d: TrackerDB, remote: Remote, userId: string): Promise<SyncResult> {
  const state = await d.syncMeta.get('state');
  if (!state || state.userId !== userId) {
    const rows = await pullAll(remote, 0);
    await applyRemote(d, rows, false);
    const inCloud = new Set(rows.map((r) => keyOf(r.tbl, r.id)));
    await d.outbox.clear();
    const local: RemoteRow[] = [];
    for (const t of syncedTables(d)) {
      for (const obj of await t.toArray()) {
        const id = primaryKey(t, obj);
        if (!inCloud.has(keyOf(t.name, id))) local.push({ tbl: t.name, id, data: obj, deleted: false, updated_at: EPOCH });
      }
    }
    for (let i = 0; i < local.length; i += 200) await remote.push(local.slice(i, i + 200));
    // Our own upload comes back on the next pull; that's harmless.
    const cursor = Math.max(0, ...rows.map((r) => r.seq ?? 0));
    await d.syncMeta.put({ key: 'state', userId, cursor, lastSync: new Date().toISOString() });
    return { pushed: local.length, pulled: rows.length, initial: true };
  }

  // Push queued local changes.
  const queued = await d.outbox.toArray();
  for (let i = 0; i < queued.length; i += 200) {
    const batch = queued.slice(i, i + 200);
    await remote.push(await rowsFor(d, batch));
    // Remove only entries that weren't changed again while uploading.
    await d.transaction('rw', d.outbox, async () => {
      for (const e of batch) {
        const cur = await d.outbox.get(e.key);
        if (cur && cur.updatedAt === e.updatedAt) await d.outbox.delete(e.key);
      }
    });
  }

  // Pull changes from other devices.
  const rows = await pullAll(remote, state.cursor);
  const pulled = await applyRemote(d, rows, true);
  const cursor = Math.max(state.cursor, ...rows.map((r) => r.seq ?? 0));
  await d.syncMeta.put({ ...state, cursor, lastSync: new Date().toISOString() });
  return { pushed: queued.length, pulled, initial: false };
}
