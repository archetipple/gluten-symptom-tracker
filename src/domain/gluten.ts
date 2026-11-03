import type { GlutenStatus, Meal, Place } from './types';

/**
 * Grains and ingredients that contain gluten. Word-boundary patterns avoid
 * false alarms like "buckwheat" or "maltodextrin".
 */
const GLUTEN_WORDS: [RegExp, string][] = [
  [/(?<!buck)wheat/i, 'wheat'],
  [/\bbarley\b/i, 'barley'],
  [/\brye\b/i, 'rye'],
  [/\bspelt\b/i, 'spelt'],
  [/\btriticale\b/i, 'triticale'],
  [/\bkamut\b|\bkhorasan\b/i, 'kamut'],
  [/\bfarro\b|\bemmer\b|\beinkorn\b/i, 'farro'],
  [/\bsemolina\b|\bdurum\b/i, 'semolina or durum'],
  [/\bbulgu?r\b/i, 'bulgur'],
  [/\bcouscous\b/i, 'couscous'],
  [/\bseitan\b/i, 'seitan'],
  [/\bmalt(ed)?\b/i, 'malt'],
  [/\bbrewer'?s yeast\b/i, "brewer's yeast"],
  [/\bgluten\b/i, 'gluten'],
];

/** The gluten-containing words found in an ingredients list. */
export function glutenWordsIn(ingredients: string | undefined): string[] {
  if (!ingredients) return [];
  // "gluten-free oats" and "wheat-free" must not count.
  const text = ingredients.replace(/\b(gluten|wheat)[\s-]+free\b/gi, '');
  return [...new Set(GLUTEN_WORDS.filter(([re]) => re.test(text)).map(([, w]) => w))];
}

const mentionsOats = (s: string | undefined) => !!s && /\boats?\b|\boatmeal\b|\boat (flour|bran|fibre|fiber)\b/i.test(s);

const tagHas = (tags: string[], ...names: string[]) => tags.some((t) => names.some((n) => t.toLowerCase().replace(/^\w\w:/, '') === n));

export interface GlutenVerdict {
  gluten: GlutenStatus;
  reasons: string[];
}

/**
 * Judge a packaged product from what Open Food Facts (or the label) says.
 * Errs on the side of caution: any sign of gluten beats a gluten-free claim.
 */
export function judgeProduct(p: { allergens: string[]; traces: string[]; labels: string[]; ingredients?: string }): GlutenVerdict {
  const reasons: string[] = [];
  const words = glutenWordsIn(p.ingredients);
  const allergenGluten = tagHas(p.allergens, 'gluten', 'wheat', 'barley', 'rye', 'spelt', 'oats-containing-gluten');
  const tracesGluten = tagHas(p.traces, 'gluten', 'wheat', 'barley', 'rye', 'spelt');
  const gfLabel = tagHas(p.labels, 'gluten-free', 'no-gluten', 'certified-gluten-free', 'crossed-grain-symbol', 'gluten-free-certification');

  if (allergenGluten) reasons.push('Allergens list gluten');
  if (words.length) reasons.push(`Ingredients mention ${words.join(', ')}`);
  if (allergenGluten || words.length) return { gluten: 'contains', reasons };

  if (tracesGluten) reasons.push('"May contain" gluten');
  if (mentionsOats(p.ingredients) && !gfLabel) reasons.push('Contains oats without a gluten-free label');
  if (gfLabel && reasons.length) reasons.push('Labelled gluten-free, but see above');
  if (reasons.length) return { gluten: 'may_contain', reasons };

  if (gfLabel) return { gluten: 'gf_label', reasons: ['Labelled gluten-free'] };
  return { gluten: 'unknown', reasons: p.ingredients ? ['No gluten listed, but not labelled gluten-free'] : ['No ingredients or allergen data'] };
}

/** Safest first. */
const ORDER: GlutenStatus[] = ['gf_label', 'naturally_gf', 'unknown', 'may_contain', 'contains'];
export const worstGluten = (list: GlutenStatus[]): GlutenStatus =>
  list.reduce<GlutenStatus>((w, s) => (ORDER.indexOf(s) > ORDER.indexOf(w) ? s : w), 'gf_label');

export const GLUTEN_TONE: Record<GlutenStatus, 'safe' | 'unsure' | 'risk' | 'gluten'> = {
  gf_label: 'safe',
  naturally_gf: 'safe',
  unknown: 'unsure',
  may_contain: 'risk',
  contains: 'gluten',
};

/** How likely a meal was to expose you to gluten. */
export type MealRisk = 'low' | 'unsure' | 'possible' | 'gluten';
export const RISK_ORDER: MealRisk[] = ['low', 'unsure', 'possible', 'gluten'];
export const RISK_LABELS: Record<MealRisk, string> = {
  low: 'Low risk',
  unsure: 'Unsure',
  possible: 'Possible exposure',
  gluten: 'Contained gluten',
};

export interface RiskVerdict {
  risk: MealRisk;
  reasons: string[];
}

/**
 * A meal's risk: its riskiest food, raised by eating away from home, a place
 * you don't rate as safe, or a cross-contact concern you ticked.
 */
export function mealRisk(meal: Meal, place?: Place): RiskVerdict {
  const reasons: string[] = [];
  let risk: MealRisk = 'low';
  const raise = (to: MealRisk, why: string) => {
    if (RISK_ORDER.indexOf(to) > RISK_ORDER.indexOf(risk)) risk = to;
    reasons.push(why);
  };

  const worst = meal.items.length ? worstGluten(meal.items.map((i) => i.gluten)) : 'unknown';
  if (worst === 'contains') raise('gluten', `${meal.items.filter((i) => i.gluten === 'contains').map((i) => i.name).join(', ')} contains gluten`);
  else if (worst === 'may_contain') raise('possible', `${meal.items.filter((i) => i.gluten === 'may_contain').map((i) => i.name).join(', ')} may contain gluten`);
  else if (worst === 'unknown') raise('unsure', meal.items.length ? 'Some foods not checked' : 'No foods listed');

  if (meal.concerns.length) raise('possible', meal.concerns.join('; '));

  const away = meal.where !== 'home';
  if (away) {
    if (place?.dedicatedGf) reasons.push(`${place.name} is fully gluten-free`);
    else if (place?.safety !== undefined && place.safety >= 4) reasons.push(`${place.name} rated safe (${place.safety}/5)`);
    else if (place?.safety !== undefined && place.safety <= 2) raise('possible', `${place.name} rated ${place.safety}/5`);
    else raise('unsure', place ? `Eaten at ${place.name}` : 'Eaten away from home');
  }
  return { risk, reasons };
}
