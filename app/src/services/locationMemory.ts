import type { GeoPoint } from '@overhead/shared';
import { roughLocation } from '@overhead/shared/rules';

const STORAGE_KEY = 'lastLocation';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createLocationMemory(storage: KeyValueStorage) {
  let last: GeoPoint | undefined;

  return {
    async remember(location: GeoPoint): Promise<void> {
      last = roughLocation(location);
      await storage.setItem(STORAGE_KEY, JSON.stringify(last));
    },

    async recall(): Promise<GeoPoint | undefined> {
      if (last) return last;
      const stored = await storage.getItem(STORAGE_KEY);
      last = stored ? roughLocation(JSON.parse(stored) as GeoPoint) : undefined;
      return last;
    },
  };
}
