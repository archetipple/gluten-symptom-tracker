import { db, newId } from '../db/db';
import { barcodeCandidates, digits, sameBarcode } from '../domain/barcode';
import { lookupBarcode } from '../domain/foods';
import type { Food } from '../domain/types';

export interface BarcodeHit {
  food: Food;
  /** Already in My foods. */
  saved: boolean;
}

/**
 * One lookup for every place a barcode is scanned or typed: your own foods
 * first, then Open Food Facts (12- and 13-digit forms). Null when not found.
 */
export async function findByBarcode(raw: string): Promise<BarcodeHit | null> {
  const code = digits(raw);
  const mine = (await db.foods.toArray()).find((f) => sameBarcode(f.barcode, code));
  if (mine) return { food: mine, saved: true };
  for (const candidate of barcodeCandidates(code)) {
    const f = await lookupBarcode(candidate, newId).catch(() => null);
    if (f) return { food: { ...f, barcode: code }, saved: false };
  }
  return null;
}
