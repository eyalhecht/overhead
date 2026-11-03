import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isOverhead, OVERHEAD_RADIUS_NM, secondsUntilExit, type Aircraft } from '../src/flights/geometry.js';

const isr053Climb: { samples: { distanceNm: number; altitudeFt: number; groundSpeedKt: number }[] } =
  JSON.parse(readFileSync(new URL('./fixtures/isr053-climb-over-ramat-gan.json', import.meta.url), 'utf8'));

const aircraft = (overrides: Partial<Aircraft> = {}): Aircraft => ({
  id: 'abc123',
  flight: 'BAW982',
  altitudeFt: 3000,
  groundSpeedKt: 120,
  trackDeg: 90,
  distanceNm: 0,
  bearingDeg: 0,
  ...overrides,
});

describe('isOverhead', () => {
  it('accepts a low plane inside the circle', () => {
    expect(isOverhead(aircraft({ distanceNm: 1.2, altitudeFt: 5500 }))).toBe(true);
  });

  it('keeps a departure that climbs past 6,000 ft right above you', () => {
    const isr053AboveRamatGan = aircraft({
      flight: 'ISR053',
      distanceNm: 0.15,
      altitudeFt: 6075,
      groundSpeedKt: 297,
    });
    const isr053TenSecondsLater = aircraft({
      flight: 'ISR053',
      distanceNm: 1.02,
      altitudeFt: 6875,
      groundSpeedKt: 296,
    });

    expect(isOverhead(isr053AboveRamatGan)).toBe(true);
    expect(isOverhead(isr053TenSecondsLater)).toBe(true);
  });

  it('counts a real departure for its whole pass inside the circle, not just until it climbs', () => {
    const { samples } = isr053Climb;
    const insideCircle = samples.filter(({ distanceNm }) => distanceNm <= OVERHEAD_RADIUS_NM);

    expect(insideCircle.every((sample) => isOverhead(aircraft(sample)))).toBe(true);
    expect(insideCircle.length).toBeGreaterThan(10);
  });

  it('rejects a plane that is too high', () => {
    expect(isOverhead(aircraft({ altitudeFt: 30000 }))).toBe(false);
  });

  it('rejects a plane outside the circle', () => {
    expect(isOverhead(aircraft({ distanceNm: 4 }))).toBe(false);
  });
});

describe('secondsUntilExit', () => {
  it('crosses half the circle from straight above: 1.5 nm at 120 kn is 45 s', () => {
    expect(secondsUntilExit(aircraft())).toBe(45);
  });

  it('is 0 for a plane on the edge flying away', () => {
    expect(secondsUntilExit(aircraft({ distanceNm: 1.5, bearingDeg: 90, trackDeg: 90 }))).toBe(0);
  });

  it('crosses the whole circle when entering on the edge: 3 nm at 120 kn is 90 s', () => {
    expect(secondsUntilExit(aircraft({ distanceNm: 1.5, bearingDeg: 90, trackDeg: 270 }))).toBe(90);
  });

  it('gives hovering aircraft a rolling minute', () => {
    expect(secondsUntilExit(aircraft({ groundSpeedKt: 0, distanceNm: 0.5 }))).toBe(60);
  });
});
