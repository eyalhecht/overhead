import { describe, expect, it } from 'vitest';
import { createLocationMemory, type KeyValueStorage } from './locationMemory';

const EXACT = { lat: 32.069_384_7, lon: 34.773_812_9 };
const ROUGH = { lat: 32.069, lon: 34.774 };

const fakeStorage = (
  saved: Record<string, string> = {},
): KeyValueStorage & { saved: Record<string, string> } => ({
  saved,
  getItem: async (key) => saved[key] ?? null,
  setItem: async (key, value) => {
    saved[key] = value;
  },
});

describe('the location the phone keeps', () => {
  it('saves only the rough location', async () => {
    const storage = fakeStorage();
    await createLocationMemory(storage).remember(EXACT);

    expect(Object.values(storage.saved).map((value) => JSON.parse(value))).toEqual([ROUGH]);
  });

  it('rounds an exact location an older version of the app saved', async () => {
    const storage = fakeStorage({ lastLocation: JSON.stringify(EXACT) });
    expect(await createLocationMemory(storage).recall()).toEqual(ROUGH);
  });

  it('knows nothing before the first location', async () => {
    expect(await createLocationMemory(fakeStorage()).recall()).toBeUndefined();
  });
});
