import { describe, expect, it } from 'vitest';
import { baseline, byFactor, byKey, byRisk, dailySeries, foodKeys, mealsBefore, settledMeals } from './patterns';
import { ms } from './time';
import type { GlutenStatus, Meal, SymptomEntry } from './types';

const meal = (id: string, at: string, food: string, gluten: GlutenStatus = 'naturally_gf'): Meal => ({
  id,
  at,
  kind: 'lunch',
  items: [{ name: food, gluten }],
  where: 'home',
  concerns: [],
  notes: '',
});
const sym = (at: string, severity: number): SymptomEntry => ({ id: at, at, symptoms: [{ type: 'Bloating', severity }], notes: '' });

const now = ms('2026-11-20T00:00');

describe('patterns', () => {
  const meals = [
    meal('a', '2026-11-01T12:00', 'Toast', 'may_contain'),
    meal('b', '2026-11-03T12:00', 'Toast', 'may_contain'),
    meal('c', '2026-11-05T12:00', 'Toast', 'may_contain'),
    meal('d', '2026-11-07T12:00', 'Rice'),
    meal('e', '2026-11-09T12:00', 'Rice'),
    meal('f', '2026-11-11T12:00', 'Rice'),
    meal('g', '2026-11-19T12:00', 'Toast', 'may_contain'), // window not over yet
  ];
  const symptoms = [sym('2026-11-01T20:00', 6), sym('2026-11-04T09:00', 5), sym('2026-11-09T13:00', 2)];
  const input = { meals, symptoms, places: [], windowHours: 24, threshold: 4, now };

  it('lists meals eaten in the window before a symptom', () => {
    const before = mealsBefore('2026-11-04T09:00', meals, 48);
    expect(before.map((b) => b.meal.id)).toEqual(['b']);
    expect(before[0].hoursBefore).toBe(21);
  });

  it('skips meals whose follow-up window is still open', () => {
    expect(settledMeals(meals, 24, now).map((m) => m.id)).not.toContain('g');
  });

  it('baseline counts only reactions at or above the threshold', () => {
    expect(baseline(input)).toMatchObject({ meals: 6, followed: 2 });
  });

  it('groups by meal risk', () => {
    const rows = byRisk(input);
    expect(rows.find((r) => r.key === 'possible')).toMatchObject({ meals: 3, followed: 2 });
    expect(rows.find((r) => r.key === 'low')).toMatchObject({ meals: 3, followed: 0 });
  });

  it('ranks foods by reaction rate and hides rare foods', () => {
    const rows = byKey(input, foodKeys);
    expect(rows.map((r) => r.label)).toEqual(['Toast', 'Rice']);
    expect(rows[0].rate).toBeCloseTo(2 / 3);
    expect(byKey(input, foodKeys, 4)).toEqual([]);
  });

  it('compares factor days with other days', () => {
    const rows = byFactor(
      [
        { date: '2026-11-01', sleepHours: 5, stress: 2, notes: '' },
        { date: '2026-11-02', sleepHours: 8, stress: 5, notes: '' },
        { date: '2026-11-04', sleepHours: 8, notes: '' },
      ],
      symptoms,
      4,
      false,
    );
    expect(rows[0]).toMatchObject({ withDays: 1, withReactions: 1, otherDays: 2, otherReactions: 1 });
    expect(rows[1]).toMatchObject({ withDays: 1, withReactions: 0, otherDays: 1, otherReactions: 1 });
    expect(rows).toHaveLength(2);
  });

  it('builds a daily series', () => {
    const s = dailySeries(['2026-11-01', '2026-11-02'], meals, symptoms, []);
    expect(s).toEqual([
      { date: '2026-11-01', severity: 6, risk: 'possible' },
      { date: '2026-11-02', severity: 0, risk: undefined },
    ]);
  });
});
