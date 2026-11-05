// The symptom catalog: body areas, the symptoms offered in each, where they can
// be felt, what pain feels like and how often it happens.

import type { SymptomEntry, SymptomScore } from './types';

export const BODY_AREAS = ['abdomen', 'head', 'skin', 'body'] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

export const AREA_LABELS: Record<BodyArea, string> = {
  abdomen: 'Abdominal',
  head: 'Brain and head',
  skin: 'Skin',
  body: 'Whole body and other',
};

export const AREA_BLURBS: Record<BodyArea, string> = {
  abdomen: 'Stomach, gut and digestion',
  head: 'Physical, thinking and mood',
  skin: 'Rashes, itching and spots',
  body: 'Joints, muscles, energy',
};

/** Symptoms offered for each area, in order. Saved in settings and editable there. */
export type SymptomLists = Record<BodyArea, string[]>;

interface CatalogItem {
  area: BodyArea;
  /** Sub-heading the chip is shown under. */
  group?: string;
  /** Offer pain descriptors (achy, stabbing...). */
  pain?: boolean;
  /** Offer a location. Off for things like nausea or low mood. */
  where?: boolean;
}

const C = (area: BodyArea, group: string | undefined, names: string[], flags: Omit<CatalogItem, 'area' | 'group'> = {}) =>
  names.map((n) => [n, { area, group, where: true, ...flags }] as const);

/** Every built-in symptom. Custom ones fall back to sensible defaults. */
export const CATALOG: Record<string, CatalogItem> = Object.fromEntries([
  ...C('abdomen', 'Pain and discomfort', ['Stomach pain', 'Cramping'], { pain: true }),
  ...C('abdomen', 'Pain and discomfort', ['Bloating', 'Gas', 'Reflux or heartburn']),
  ...C('abdomen', 'Digestion', ['Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Urgency', 'Loss of appetite'], { where: false }),
  ...C('head', 'Physical', ['Headache', 'Migraine', 'Jaw or face pain'], { pain: true }),
  ...C('head', 'Physical', ['Dizziness', 'Mouth ulcers', 'Sore tongue'], {}),
  ...C('head', 'Thinking', ['Brain fog', 'Trouble concentrating', 'Forgetful', 'Slow thinking'], { where: false }),
  ...C('head', 'Mood', ['Low mood', 'Irritable', 'Anxiety', 'Mood swings'], { where: false }),
  ...C('skin', undefined, ['Itchy rash', 'Blistering rash', 'Hives', 'Redness', 'Itching without rash', 'Dry or flaky skin', 'Eczema flare', 'Acne or spots']),
  ...C('body', undefined, ['Joint pain', 'Muscle aches'], { pain: true }),
  ...C('body', undefined, ['Tingling or numbness']),
  ...C('body', undefined, ['Fatigue', 'Chills or feverish'], { where: false }),
  // Names from the first version of the symptom list, so old entries land in the right area.
  ...C('head', 'Mood', ['Low mood or irritable'], { where: false }),
]);

export const DEFAULT_SYMPTOM_LISTS: SymptomLists = {
  abdomen: ['Bloating', 'Stomach pain', 'Cramping', 'Gas', 'Reflux or heartburn', 'Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Urgency', 'Loss of appetite'],
  head: ['Headache', 'Migraine', 'Dizziness', 'Mouth ulcers', 'Brain fog', 'Trouble concentrating', 'Forgetful', 'Low mood', 'Irritable', 'Anxiety'],
  skin: ['Itchy rash', 'Blistering rash', 'Hives', 'Redness', 'Itching without rash', 'Dry or flaky skin'],
  body: ['Fatigue', 'Joint pain', 'Muscle aches', 'Tingling or numbness'],
};

/** The flat list the app shipped with before body areas. */
export const LEGACY_DEFAULT_SYMPTOMS = [
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

/**
 * Per-area lists from an old flat list. An untouched default list gets the new
 * defaults; a customised one keeps its symptoms, each in its catalog area.
 */
export function listsFromLegacy(types: string[] | undefined): SymptomLists {
  if (!types || (types.length === LEGACY_DEFAULT_SYMPTOMS.length && LEGACY_DEFAULT_SYMPTOMS.every((t) => types.includes(t)))) return DEFAULT_SYMPTOM_LISTS;
  const out: SymptomLists = { abdomen: [], head: [], skin: [], body: [] };
  for (const t of types) out[CATALOG[t]?.area ?? 'body'].push(t);
  return out;
}

/** Which area a symptom belongs to: as logged, else your lists, else the catalog. */
export function areaOf(x: Pick<SymptomScore, 'type' | 'area'>, lists?: SymptomLists): BodyArea {
  if (x.area) return x.area;
  if (lists) for (const a of BODY_AREAS) if (lists[a].includes(x.type)) return a;
  return CATALOG[x.type]?.area ?? 'body';
}

export const isPain = (type: string) => CATALOG[type]?.pain ?? /pain|ache|cramp|sore/i.test(type);
export const hasWhere = (type: string) => CATALOG[type]?.where ?? true;
export const groupOf = (type: string) => CATALOG[type]?.group;

/** Abdomen as the nine regions doctors use, laid out as a 3 by 3 grid. */
export const ABDOMEN_GRID = [
  ['Upper left', 'Upper middle (stomach)', 'Upper right (liver)'],
  ['Left side', 'Belly button', 'Right side'],
  ['Lower left', 'Lower middle (pelvic)', 'Lower right'],
];

export const LOCATIONS: Record<BodyArea, string[]> = {
  abdomen: ['All over', 'Moves around', 'Chest or throat', 'Back'],
  head: ['Forehead', 'Temples', 'Behind the eyes', 'Top of head', 'Back of head', 'Whole head', 'Jaw or face', 'Mouth', 'Neck'],
  skin: ['Face', 'Scalp', 'Neck', 'Chest', 'Back', 'Stomach', 'Arms', 'Elbows', 'Hands', 'Buttocks', 'Legs', 'Knees', 'Feet', 'All over'],
  body: ['Neck', 'Shoulders', 'Back', 'Arms', 'Elbows', 'Hands or wrists', 'Hips', 'Legs', 'Knees', 'Ankles or feet', 'All over'],
};

/** Offered after the locations for areas that aren't already split left and right. */
export const SIDES: Record<BodyArea, string[]> = {
  abdomen: [],
  head: ['Left side', 'Right side', 'Both sides'],
  skin: ['Left side', 'Right side', 'Both sides'],
  body: ['Left side', 'Right side', 'Both sides'],
};

export const PAIN_TYPES = ['Achy', 'Dull', 'Sharp', 'Stabbing', 'Throbbing', 'Pulling', 'Burning', 'Cramping', 'Pressure', 'Tender'];

export const FREQUENCIES = ['constant', 'intermittent', 'waves', 'once'] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  constant: 'Constant',
  intermittent: 'Comes and goes',
  waves: 'In waves',
  once: 'Once, brief',
};

/** Short description of one symptom's details, e.g. "upper right (liver), stabbing, comes and goes, 2 h". */
export function describe(x: SymptomScore): string {
  const parts = [...(x.locations ?? []), ...(x.qualities ?? [])].map((p) => p.toLowerCase());
  if (x.frequency) parts.push(FREQUENCY_LABELS[x.frequency].toLowerCase());
  if (x.durationHours !== undefined) parts.push(`${x.durationHours} h`);
  return parts.join(', ');
}

/** Ratings still missing before an entry can be saved. */
export const unrated = (s: SymptomEntry) => s.symptoms.filter((x) => !(x.severity >= 1));
