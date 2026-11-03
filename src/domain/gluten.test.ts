import { describe, expect, it } from 'vitest';
import { glutenWordsIn, judgeProduct, mealRisk, worstGluten } from './gluten';
import { offToFood } from './foods';
import type { Meal, Place } from './types';

describe('gluten words in ingredients', () => {
  it('finds gluten grains', () => {
    expect(glutenWordsIn('Enriched wheat flour, sugar, barley malt extract')).toEqual(['wheat', 'barley', 'malt']);
    expect(glutenWordsIn('Durum semolina')).toEqual(['semolina or durum']);
  });
  it('ignores look-alikes and gluten-free claims', () => {
    expect(glutenWordsIn('Buckwheat flour, maltodextrin, rice')).toEqual([]);
    expect(glutenWordsIn('Gluten-free oats, wheat free')).toEqual([]);
    expect(glutenWordsIn('Glyceryl stearate, ryegrass-free')).toEqual([]);
  });
});

describe('judging a product', () => {
  it('allergens or ingredients with gluten mean contains, even with a gluten-free label', () => {
    expect(judgeProduct({ allergens: ['en:gluten'], traces: [], labels: ['en:gluten-free'] }).gluten).toBe('contains');
    expect(judgeProduct({ allergens: [], traces: [], labels: [], ingredients: 'rye flour' }).gluten).toBe('contains');
  });
  it('"may contain" and unlabelled oats are a caution', () => {
    expect(judgeProduct({ allergens: [], traces: ['en:wheat'], labels: [] }).gluten).toBe('may_contain');
    expect(judgeProduct({ allergens: [], traces: [], labels: [], ingredients: 'Whole grain oats' }).gluten).toBe('may_contain');
    expect(judgeProduct({ allergens: [], traces: [], labels: ['en:gluten-free'], ingredients: 'Whole grain oats' }).gluten).toBe('gf_label');
  });
  it('a gluten-free label with traces is still a caution', () => {
    const v = judgeProduct({ allergens: [], traces: ['en:gluten'], labels: ['en:gluten-free'] });
    expect(v.gluten).toBe('may_contain');
    expect(v.reasons.join(' ')).toMatch(/Labelled gluten-free, but/);
  });
  it('no gluten listed but no label stays not checked', () => {
    expect(judgeProduct({ allergens: ['en:milk'], traces: [], labels: [], ingredients: 'milk, salt' }).gluten).toBe('unknown');
  });
  it('reads an Open Food Facts product', () => {
    const f = offToFood(
      { code: '123', product_name: 'Rice crackers', brands: 'Acme, Other', allergens_tags: [], traces_tags: [], labels_tags: ['en:gluten-free', 'en:organic'], ingredients_text_en: 'rice, salt' },
      'id1',
    )!;
    expect(f).toMatchObject({ name: 'Rice crackers', brand: 'Acme', gluten: 'gf_label', labels: ['gluten free'] });
  });
});

describe('meal risk', () => {
  const meal = (over: Partial<Meal>): Meal => ({ id: 'm', at: '2026-11-01T12:00', kind: 'lunch', items: [{ name: 'Rice', gluten: 'naturally_gf' }], where: 'home', concerns: [], notes: '', ...over });
  const place = (over: Partial<Place>): Place => ({ id: 'p', name: 'Cafe', kind: 'cafe', area: '', gfMenu: false, dedicatedFryer: false, separatePrep: false, dedicatedGf: false, favourite: false, notes: '', ...over });

  it('safe food at home is low risk', () => {
    expect(mealRisk(meal({})).risk).toBe('low');
  });
  it('the riskiest food sets the level', () => {
    expect(worstGluten(['gf_label', 'may_contain', 'unknown'])).toBe('may_contain');
    expect(mealRisk(meal({ items: [{ name: 'Rice', gluten: 'naturally_gf' }, { name: 'Bread', gluten: 'contains' }] })).risk).toBe('gluten');
  });
  it('eating out is unsure unless the place is rated safe', () => {
    expect(mealRisk(meal({ where: 'restaurant' })).risk).toBe('unsure');
    expect(mealRisk(meal({ where: 'restaurant', placeId: 'p' }), place({ safety: 5 })).risk).toBe('low');
    expect(mealRisk(meal({ where: 'restaurant', placeId: 'p' }), place({ dedicatedGf: true })).risk).toBe('low');
    expect(mealRisk(meal({ where: 'restaurant', placeId: 'p' }), place({ safety: 2 })).risk).toBe('possible');
  });
  it('a ticked cross-contact concern means possible exposure', () => {
    expect(mealRisk(meal({ concerns: ['Shared toaster, fryer or prep area'] })).risk).toBe('possible');
  });
});
