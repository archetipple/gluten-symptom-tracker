import Dexie, { type Table } from 'dexie';
import { LOCAL_ONLY, installChangeTracking, markAllForPush, type OutboxEntry, type SyncState } from '../sync/engine';
import type { BowelEntry, DayFactors, Food, Id, Meal, Med, MedDose, Place, Settings, SymptomEntry } from '../domain/types';

export const DEFAULT_SYMPTOMS = [
  'Bloating',
  'Stomach pain',
  'Gas',
  'Nausea',
  'Diarrhea',
  'Constipation',
  'Reflux or heartburn',
  'Fatigue',
  'Brain fog',
  'Headache',
  'Joint pain',
  'Itchy rash',
  'Mouth ulcers',
  'Low mood or irritable',
  'Anxiety',
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  symptomTypes: DEFAULT_SYMPTOMS,
  windowHours: 24,
  reactionSeverity: 4,
  trackPeriod: true,
  trackBowel: true,
};

export class TrackerDB extends Dexie {
  settings!: Table<Settings, string>;
  foods!: Table<Food, Id>;
  meals!: Table<Meal, Id>;
  symptoms!: Table<SymptomEntry, Id>;
  bowel!: Table<BowelEntry, Id>;
  days!: Table<DayFactors, string>;
  meds!: Table<Med, Id>;
  doses!: Table<MedDose, Id>;
  places!: Table<Place, Id>;
  outbox!: Table<OutboxEntry, string>;
  syncMeta!: Table<SyncState, string>;

  constructor(name = 'celiac-tracker') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      foods: 'id, name, barcode',
      meals: 'id, at',
      symptoms: 'id, at',
      bowel: 'id, at',
      days: 'date',
      meds: 'id, name',
      doses: 'id, at, medId',
      places: 'id, name',
      // Cloud sync bookkeeping (never synced or exported).
      outbox: 'key',
      syncMeta: 'key',
    });
    installChangeTracking(this);
  }
}

export const db = new TrackerDB();

export const newId = (): Id => crypto.randomUUID();

/** First run: default settings. */
export async function ensureSeeded(d: TrackerDB = db): Promise<void> {
  if (!(await d.settings.get('settings'))) await d.settings.put(DEFAULT_SETTINGS);
}

/** Full JSON backup of everything stored on this device. */
export async function exportAll(d: TrackerDB = db) {
  const out: Record<string, unknown[]> = {};
  for (const t of d.tables) if (!LOCAL_ONLY.has(t.name)) out[t.name] = await t.toArray();
  return { app: 'celiac-tracker', version: 1, exportedAt: new Date().toISOString(), data: out };
}

export async function importAll(payload: { data: Record<string, unknown[]> }, d: TrackerDB = db) {
  const tables = d.tables.filter((t) => !LOCAL_ONLY.has(t.name));
  await d.transaction('rw', tables, async () => {
    for (const t of tables) {
      const rows = payload.data[t.name];
      if (!rows) continue;
      await t.clear();
      await t.bulkPut(rows as never[]);
    }
  });
  // A restore is deliberate: upload everything as the newest version.
  await markAllForPush(d);
}
