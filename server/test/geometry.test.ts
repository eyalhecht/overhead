import { describe, expect, it } from 'vitest';
import { isOverhead, secondsUntilExit, type Aircraft } from '../src/flights/geometry.js';

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
