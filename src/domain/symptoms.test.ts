import { describe as group, expect, it } from 'vitest';
import { fmtDuration, splitHours } from './time';
import { DEFAULT_SYMPTOM_LISTS, LEGACY_DEFAULT_SYMPTOMS, areaOf, describe, hasWhere, isPain, listsFromLegacy, unrated } from './symptoms';

group('symptom catalog', () => {
  it('gives an untouched old list the new defaults', () => {
    expect(listsFromLegacy(undefined)).toBe(DEFAULT_SYMPTOM_LISTS);
    expect(listsFromLegacy([...LEGACY_DEFAULT_SYMPTOMS].reverse())).toBe(DEFAULT_SYMPTOM_LISTS);
  });

  it('sorts a customised old list into areas, unknown ones under whole body', () => {
    expect(listsFromLegacy(['Bloating', 'Headache', 'Itchy rash', 'Low mood or irritable', 'Toe cramps'])).toEqual({
      abdomen: ['Bloating'],
      head: ['Headache', 'Low mood or irritable'],
      skin: ['Itchy rash'],
      body: ['Toe cramps'],
    });
  });

  it('finds the area from the entry, then the lists, then the catalog', () => {
    expect(areaOf({ type: 'Headache', area: 'skin' })).toBe('skin');
    expect(areaOf({ type: 'Toe cramps' }, { ...DEFAULT_SYMPTOM_LISTS, skin: ['Toe cramps'] })).toBe('skin');
    expect(areaOf({ type: 'Brain fog' })).toBe('head');
    expect(areaOf({ type: 'Something new' })).toBe('body');
  });

  it('offers pain words and locations only where they make sense', () => {
    expect(isPain('Stomach pain')).toBe(true);
    expect(isPain('Nausea')).toBe(false);
    expect(isPain('Sore knee')).toBe(true);
    expect(hasWhere('Brain fog')).toBe(false);
    expect(hasWhere('Itchy rash')).toBe(true);
    expect(hasWhere('Anything custom')).toBe(true);
  });

  it('describes details and flags unrated symptoms', () => {
    expect(describe({ type: 'Stomach pain', severity: 6, locations: ['Upper right (liver)'], qualities: ['Stabbing'], frequency: 'intermittent', durationHours: 2 })).toBe(
      'upper right (liver), stabbing, comes and goes, 2 h',
    );
    expect(describe({ type: 'Gas', severity: 3 })).toBe('');
    expect(unrated({ id: 'x', at: '2026-11-05T09:00', notes: '', symptoms: [{ type: 'Gas', severity: 0 }, { type: 'Nausea', severity: 4 }] }).map((x) => x.type)).toEqual(['Gas']);
  });

  it('formats durations in hours and minutes', () => {
    expect(splitHours(1.5)).toEqual({ h: 1, m: 30 });
    expect(splitHours(20 / 60)).toEqual({ h: 0, m: 20 });
    expect(fmtDuration(0.75)).toBe('45 min');
    expect(fmtDuration(2)).toBe('2 h');
    expect(fmtDuration(1 + 5 / 60)).toBe('1 h 5 min');
    expect(describe({ type: 'Nausea', severity: 4, durationHours: 0.5 })).toBe('30 min');
  });
});
