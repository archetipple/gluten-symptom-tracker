import { mealRisk, RISK_ORDER, type MealRisk } from './gluten';
import { dayOf, ms } from './time';
import type { DateStr, DayFactors, Meal, Place, SymptomEntry } from './types';

const HOUR = 3600000;

export const maxSeverity = (s: SymptomEntry) => Math.max(0, ...s.symptoms.map((x) => x.severity));

/** Symptom entries strong enough to count as a reaction. */
export const reactionsOf = (symptoms: SymptomEntry[], threshold: number) => symptoms.filter((s) => maxSeverity(s) >= threshold);

export interface MealBefore {
  meal: Meal;
  hoursBefore: number;
}

/** Meals eaten in the `windowHours` before a symptom, most recent first. */
export function mealsBefore(at: string, meals: Meal[], windowHours: number): MealBefore[] {
  const t = ms(at);
  return meals
    .map((meal) => ({ meal, hoursBefore: (t - ms(meal.at)) / HOUR }))
    .filter((x) => x.hoursBefore >= 0 && x.hoursBefore <= windowHours)
    .sort((a, b) => a.hoursBefore - b.hoursBefore);
}

/** Was there a reaction within the window after this meal? */
export function followedByReaction(meal: Meal, reactions: SymptomEntry[], windowHours: number): boolean {
  const t = ms(meal.at);
  return reactions.some((r) => {
    const gap = (ms(r.at) - t) / HOUR;
    return gap > 0 && gap <= windowHours;
  });
}

/** Meals whose whole follow-up window has passed, so we know whether a reaction came. */
export const settledMeals = (meals: Meal[], windowHours: number, now = Date.now()) => meals.filter((m) => ms(m.at) + windowHours * HOUR <= now);

export interface Row {
  key: string;
  label: string;
  meals: number;
  followed: number;
  /** Share of these meals followed by a reaction, 0 to 1. */
  rate: number;
}

const row = (key: string, label: string, meals: number, followed: number): Row => ({ key, label, meals, followed, rate: meals ? followed / meals : 0 });

export interface PatternInput {
  meals: Meal[];
  symptoms: SymptomEntry[];
  places: Place[];
  windowHours: number;
  threshold: number;
  now?: number;
}

/** Share of all settled meals followed by a reaction: the yardstick for every other row. */
export function baseline(input: PatternInput): Row {
  const meals = settledMeals(input.meals, input.windowHours, input.now);
  const reactions = reactionsOf(input.symptoms, input.threshold);
  return row('all', 'All meals', meals.length, meals.filter((m) => followedByReaction(m, reactions, input.windowHours)).length);
}

/** Reaction rate by how risky the meal was. */
export function byRisk(input: PatternInput): Row[] {
  const meals = settledMeals(input.meals, input.windowHours, input.now);
  const reactions = reactionsOf(input.symptoms, input.threshold);
  const places = new Map(input.places.map((p) => [p.id, p]));
  const groups = new Map<MealRisk, Meal[]>();
  for (const m of meals) {
    const r = mealRisk(m, m.placeId ? places.get(m.placeId) : undefined).risk;
    groups.set(r, [...(groups.get(r) ?? []), m]);
  }
  return RISK_ORDER.filter((r) => groups.has(r)).map((r) => {
    const list = groups.get(r)!;
    return row(r, r, list.length, list.filter((m) => followedByReaction(m, reactions, input.windowHours)).length);
  });
}

/**
 * Reaction rate per food (or per place), riskiest first. Rows eaten fewer
 * than `minMeals` times are left out because a rate from one or two meals
 * means little.
 */
export function byKey(input: PatternInput, keysOf: (m: Meal) => { key: string; label: string }[], minMeals = 3): Row[] {
  const meals = settledMeals(input.meals, input.windowHours, input.now);
  const reactions = reactionsOf(input.symptoms, input.threshold);
  const acc = new Map<string, { label: string; meals: number; followed: number }>();
  for (const m of meals) {
    const hit = followedByReaction(m, reactions, input.windowHours);
    const seen = new Set<string>();
    for (const k of keysOf(m)) {
      if (seen.has(k.key)) continue;
      seen.add(k.key);
      const a = acc.get(k.key) ?? { label: k.label, meals: 0, followed: 0 };
      a.meals++;
      if (hit) a.followed++;
      acc.set(k.key, a);
    }
  }
  return [...acc.entries()]
    .filter(([, a]) => a.meals >= minMeals)
    .map(([key, a]) => row(key, a.label, a.meals, a.followed))
    .sort((a, b) => b.rate - a.rate || b.meals - a.meals);
}

/** A food's identity: saved food id, else its name (case and spacing ignored). */
export const foodKeys = (m: Meal) => m.items.map((i) => ({ key: i.foodId ?? `name:${i.name.trim().toLowerCase()}`, label: i.name }));

export const placeKeys = (places: Place[]) => {
  const byId = new Map(places.map((p) => [p.id, p]));
  return (m: Meal) => (m.placeId && byId.has(m.placeId) ? [{ key: m.placeId, label: byId.get(m.placeId)!.name }] : []);
};

export interface FactorRow {
  label: string;
  /** Days with this factor and a reaction / days with this factor. */
  withDays: number;
  withReactions: number;
  /** Other check-in days. */
  otherDays: number;
  otherReactions: number;
}

/**
 * Compare reaction days on days with a factor (poor sleep, high stress, period)
 * against other days that had a check-in.
 */
export function byFactor(days: DayFactors[], symptoms: SymptomEntry[], threshold: number, trackPeriod: boolean): FactorRow[] {
  const reactionDays = new Set(reactionsOf(symptoms, threshold).map((s) => dayOf(s.at)));
  const factors: { label: string; test: (d: DayFactors) => boolean | undefined }[] = [
    {
      label: 'Poor sleep (under 6 h or quality 1 to 2)',
      test: (d) => (d.sleepHours === undefined && d.sleepQuality === undefined ? undefined : (d.sleepHours ?? 99) < 6 || (d.sleepQuality ?? 5) <= 2),
    },
    { label: 'High stress (4 or 5)', test: (d) => (d.stress === undefined ? undefined : d.stress >= 4) },
  ];
  if (trackPeriod) factors.push({ label: 'Period', test: (d) => (d.period === undefined ? undefined : d.period !== 'none') });
  return factors.map((f) => {
    const r: FactorRow = { label: f.label, withDays: 0, withReactions: 0, otherDays: 0, otherReactions: 0 };
    for (const d of days) {
      const v = f.test(d);
      if (v === undefined) continue;
      const hit = reactionDays.has(d.date);
      if (v) {
        r.withDays++;
        if (hit) r.withReactions++;
      } else {
        r.otherDays++;
        if (hit) r.otherReactions++;
      }
    }
    return r;
  });
}

export interface DayPoint {
  date: DateStr;
  /** Highest symptom severity that day, 0 if none logged. */
  severity: number;
  /** Riskiest meal that day, if any meals were logged. */
  risk?: MealRisk;
}

export function dailySeries(dates: DateStr[], meals: Meal[], symptoms: SymptomEntry[], places: Place[]): DayPoint[] {
  const byPlace = new Map(places.map((p) => [p.id, p]));
  return dates.map((date) => {
    const sev = Math.max(0, ...symptoms.filter((s) => dayOf(s.at) === date).map(maxSeverity));
    const risks = meals.filter((m) => dayOf(m.at) === date).map((m) => mealRisk(m, m.placeId ? byPlace.get(m.placeId) : undefined).risk);
    const risk = risks.length ? risks.reduce((w, r) => (RISK_ORDER.indexOf(r) > RISK_ORDER.indexOf(w) ? r : w)) : undefined;
    return { date, severity: sev, risk };
  });
}

export interface SymptomCount {
  type: string;
  count: number;
  avgSeverity: number;
}

export function symptomCounts(symptoms: SymptomEntry[]): SymptomCount[] {
  const acc = new Map<string, number[]>();
  for (const s of symptoms) for (const x of s.symptoms) acc.set(x.type, [...(acc.get(x.type) ?? []), x.severity]);
  return [...acc.entries()]
    .map(([type, v]) => ({ type, count: v.length, avgSeverity: v.reduce((a, b) => a + b, 0) / v.length }))
    .sort((a, b) => b.count - a.count);
}
