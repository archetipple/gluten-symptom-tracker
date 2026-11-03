import { judgeProduct } from './gluten';
import type { Food } from './types';

/** Fetch with retries and a 10 s limit: Open Food Facts is sometimes briefly overloaded. */
async function fetchRetry(url: string, tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e; // overload replies often arrive without CORS headers and surface as network errors
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  throw last;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  allergens_tags?: string[];
  traces_tags?: string[];
  labels_tags?: string[];
  ingredients_text_en?: string;
  ingredients_text?: string;
}

/** "en:gluten" -> "gluten". */
const clean = (tags?: string[]) => (tags ?? []).map((t) => t.replace(/^\w\w:/, '').replace(/-/g, ' '));

/** An Open Food Facts product as a food, with its gluten status worked out. */
export function offToFood(p: OffProduct, id: string): Food | null {
  const name = (p.product_name_en || p.product_name)?.trim();
  if (!name) return null;
  const ingredients = (p.ingredients_text_en || p.ingredients_text || '').trim() || undefined;
  const verdict = judgeProduct({
    allergens: p.allergens_tags ?? [],
    traces: p.traces_tags ?? [],
    labels: p.labels_tags ?? [],
    ingredients,
  });
  return {
    id,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code,
    gluten: verdict.gluten,
    reasons: verdict.reasons,
    ingredients,
    allergens: clean(p.allergens_tags),
    traces: clean(p.traces_tags),
    labels: clean(p.labels_tags).filter((l) => /gluten|grain/i.test(l)),
    source: 'openfoodfacts',
    favourite: false,
    notes: '',
  };
}

const OFF = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,brands,allergens_tags,traces_tags,labels_tags,ingredients_text_en,ingredients_text';

export async function searchOpenFoodFacts(query: string, newId: () => string): Promise<Food[]> {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=20&fields=${FIELDS}`;
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`Food search failed (${res.status})`);
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).map((p) => offToFood(p, newId())).filter((f): f is Food => f !== null);
}

export async function lookupBarcode(code: string, newId: () => string): Promise<Food | null> {
  const res = await fetchRetry(`${OFF}/api/v2/product/${encodeURIComponent(code.trim())}.json?fields=${FIELDS}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { product?: OffProduct };
  return data.product ? offToFood({ ...data.product, code: code.trim() }, newId()) : null;
}
