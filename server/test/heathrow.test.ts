import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadRecording } from './support/recordings.js';
import { cityStreet, openPark } from './support/person.js';
import { replay, score } from './support/replay.js';

// Heathrow landing east on 09L, recorded 3 Nov 2026. Arrivals ride a 3 degree glide path, so their height
// at any point on the approach is known in advance.
const arrivals = loadRecording(
  fileURLToPath(new URL('./fixtures/heathrow-09l-arrivals.jsonl', import.meta.url)),
);

const THRESHOLD_09L = { lat: 51.4775, lon: -0.485 };
const KM_PER_DEG_LAT = 111.2;
const kmEast = (km: number) => km / (KM_PER_DEG_LAT * Math.cos((THRESHOLD_09L.lat * Math.PI) / 180));

const THREE_NM_KM = 3 * 1.852;
const DATCHET = { lat: THRESHOLD_09L.lat, lon: THRESHOLD_09L.lon - kmEast(THREE_NM_KM) };
const TWELVE_KM_NORTH = { lat: DATCHET.lat + 12 / KM_PER_DEG_LAT, lon: DATCHET.lon };

const RUNWAY_ELEVATION_FT = 78;
const GEOID_ABOVE_SEA_FT = 151;
const FT_PER_M = 3.2808;

describe('Heathrow arrivals over Datchet, 3 nm before runway 09L', () => {
  it('fly over at the height a 3 degree glide path predicts, about 1,180 ft GPS altitude', () => {
    const glideFt = THREE_NM_KM * 1000 * Math.tan((3 * Math.PI) / 180) * FT_PER_M;
    const expectedFt = glideFt + RUNWAY_ELEVATION_FT + GEOID_ABOVE_SEA_FT;
    const overhead = arrivals
      .flatMap(({ planes }) => planes)
      .filter((plane) => Math.abs(plane.lon - DATCHET.lon) < kmEast(0.3) && typeof plane.alt === 'number');

    expect(overhead.length).toBeGreaterThan(0);
    for (const plane of overhead) expect(Math.abs((plane.geom ?? 0) - expectedFt)).toBeLessThan(250);
  });

  it('gives someone under the approach a card for every arrival they see', async () => {
    const person = { name: 'datchet', at: DATCHET, rooftopDeg: cityStreet(3) };
    const card = score((await replay(arrivals, [person])).get('datchet') ?? []);

    expect(card.passes).toBeGreaterThanOrEqual(4);
    expect(card.passesWithCard).toBe(card.passes);
  });

  it('gives nobody 12 km to the side a card for planes that low', async () => {
    const person = { name: 'north', at: TWELVE_KM_NORTH, rooftopDeg: openPark };
    const card = score((await replay(arrivals, [person])).get('north') ?? []);

    expect(card.passes).toBe(0);
    expect(card.cards).toBe(0);
  });
});
