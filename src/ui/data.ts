import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../db/db';
import { listsFromLegacy, type SymptomLists } from '../domain/symptoms';
import type { Settings } from '../domain/types';

export function useSettings(): Settings & { symptomLists: SymptomLists } {
  const s = useLiveQuery(() => db.settings.get('settings'), []);
  // Settings saved before body areas only have the flat list: sort it into areas.
  const symptomLists = s?.symptomLists ?? (s ? listsFromLegacy(s.symptomTypes) : DEFAULT_SETTINGS.symptomLists!);
  return { ...DEFAULT_SETTINGS, ...s, symptomLists };
}

/**
 * Go back, or to `fallback` when this page was opened directly (a link or a
 * reload with no earlier page in the app), so Back never leaves the app.
 */
export function useBack(fallback: string) {
  const nav = useNavigate();
  return () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav(fallback, { replace: true }));
}

export const usePlaces = () => useLiveQuery(() => db.places.orderBy('name').toArray(), []) ?? [];
export const useFoods = () => useLiveQuery(() => db.foods.orderBy('name').toArray(), []) ?? [];
export const useMeds = () => useLiveQuery(() => db.meds.orderBy('name').toArray(), []) ?? [];
