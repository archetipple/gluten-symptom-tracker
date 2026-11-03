// Core data model. Times are local wall-clock strings "YYYY-MM-DDTHH:mm" so an
// entry stays at the hour it was eaten or felt, whatever time zone you're in later.

export type Id = string;
/** Local date "YYYY-MM-DD". */
export type DateStr = string;
/** Local date and time "YYYY-MM-DDTHH:mm". */
export type LocalTime = string;

/**
 * How safe a food is for someone with celiac disease.
 * - gf_label: labelled or certified gluten-free
 * - naturally_gf: plain whole food with no gluten (fresh fruit, plain rice...)
 * - may_contain: "may contain" wheat/gluten, oats without a gluten-free label, or a mixed signal
 * - contains: lists gluten, wheat, barley, rye, malt and so on
 * - unknown: not checked yet
 */
export type GlutenStatus = 'gf_label' | 'naturally_gf' | 'may_contain' | 'contains' | 'unknown';

export const GLUTEN_LABELS: Record<GlutenStatus, string> = {
  gf_label: 'Gluten-free label',
  naturally_gf: 'Naturally gluten-free',
  may_contain: 'May contain gluten',
  contains: 'Contains gluten',
  unknown: 'Not checked',
};

export interface Settings {
  id: 'settings';
  /** Symptoms offered in the symptom log, in order. */
  symptomTypes: string[];
  /** Hours before a symptom to look at food (Patterns and symptom details). */
  windowHours: number;
  /** A symptom at or above this severity (1 to 10) counts as a reaction in Patterns. */
  reactionSeverity: number;
  trackPeriod: boolean;
  trackBowel: boolean;
}

export interface Food {
  id: Id;
  name: string;
  brand?: string;
  barcode?: string;
  gluten: GlutenStatus;
  /** Why the status was set, e.g. "Allergens: gluten" or "Label: gluten-free". */
  reasons: string[];
  ingredients?: string;
  allergens: string[];
  traces: string[];
  labels: string[];
  source: 'manual' | 'openfoodfacts';
  favourite: boolean;
  notes: string;
}

export const MEAL_KINDS = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'] as const;
export type MealKind = (typeof MEAL_KINDS)[number];

export const WHERE = ['home', 'restaurant', 'takeout', 'someone_else', 'work_school', 'other'] as const;
export type Where = (typeof WHERE)[number];
export const WHERE_LABELS: Record<Where, string> = {
  home: 'Home',
  restaurant: 'Restaurant',
  takeout: 'Takeout',
  someone_else: "Someone else's home",
  work_school: 'Work or school',
  other: 'Other',
};

/** Things that raise the chance of cross-contact even when the food itself is gluten-free. */
export const CONCERNS = [
  'Shared toaster, fryer or prep area',
  "Wasn't sure of the ingredients",
  'Saw possible cross-contact',
  "Staff weren't sure about gluten",
  'Ate something not on my safe list',
] as const;

export interface MealItem {
  foodId?: Id;
  name: string;
  amount?: string;
  gluten: GlutenStatus;
}

export interface Meal {
  id: Id;
  at: LocalTime;
  kind: MealKind;
  items: MealItem[];
  where: Where;
  placeId?: Id;
  concerns: string[];
  notes: string;
}

export interface SymptomScore {
  type: string;
  /** 1 (barely) to 10 (worst). */
  severity: number;
}

export interface SymptomEntry {
  id: Id;
  at: LocalTime;
  symptoms: SymptomScore[];
  /** How long it lasted, in hours, if known. */
  durationHours?: number;
  notes: string;
}

export interface BowelEntry {
  id: Id;
  at: LocalTime;
  /** Bristol stool scale 1 to 7. */
  bristol: number;
  urgent: boolean;
  /** Blood, or black and tarry: worth telling a doctor about. */
  blood: boolean;
  notes: string;
}

export const FLOW = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;
export type Flow = (typeof FLOW)[number];

/** One check-in per day: sleep, stress and (optionally) period. */
export interface DayFactors {
  date: DateStr;
  sleepHours?: number;
  /** 1 (poor) to 5 (great). */
  sleepQuality?: number;
  /** 1 (calm) to 5 (very stressed). */
  stress?: number;
  period?: Flow;
  notes: string;
}

export interface Med {
  id: Id;
  name: string;
  dose: string;
  kind: 'medication' | 'supplement';
  /** Daily items show as a checklist on Today; as-needed items have an "add" button. */
  schedule: 'daily' | 'as_needed';
  archived: boolean;
  notes: string;
}

export interface MedDose {
  id: Id;
  medId: Id;
  at: LocalTime;
  notes: string;
}

export const PLACE_KINDS = ['restaurant', 'cafe', 'bakery', 'takeout', 'grocery', 'home', 'other'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export interface Place {
  id: Id;
  name: string;
  kind: PlaceKind;
  area: string;
  /** Your own rating, 1 (avoid) to 5 (feel very safe). */
  safety?: number;
  gfMenu: boolean;
  dedicatedFryer: boolean;
  separatePrep: boolean;
  /** Whole kitchen is gluten-free. */
  dedicatedGf: boolean;
  favourite: boolean;
  notes: string;
}
