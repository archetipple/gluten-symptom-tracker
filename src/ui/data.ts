import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS } from '../db/db';

export function useSettings() {
  const s = useLiveQuery(() => db.settings.get('settings'), []);
  return { ...DEFAULT_SETTINGS, ...s };
}

export const usePlaces = () => useLiveQuery(() => db.places.orderBy('name').toArray(), []) ?? [];
export const useFoods = () => useLiveQuery(() => db.foods.orderBy('name').toArray(), []) ?? [];
export const useMeds = () => useLiveQuery(() => db.meds.orderBy('name').toArray(), []) ?? [];
