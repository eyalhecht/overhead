import { describe, expect, it } from 'vitest';
import { aircraftBuild, isNoticeable, type Sighting } from '../src/flights/perception.js';

const KM_PER_NM = 1.852;

const sighting = (overrides: Partial<Sighting> & { distanceKm?: number } = {}): Sighting => {
  const { distanceKm = 0, ...rest } = overrides;
  return { distanceNm: distanceKm / KM_PER_NM, altitudeFt: 3000, build: aircraftBuild('B738'), ...rest };
};

describe('isNoticeable', () => {
  it('notices an airliner 3,000 ft right above you', () => {
    expect(isNoticeable(sighting())).toBe(true);
  });

  it('does not notice an airliner cruising at 35,000 ft', () => {
    expect(isNoticeable(sighting({ altitudeFt: 35_000 }))).toBe(false);
  });

  it('does not notice a small Cessna 2.5 km away', () => {
    expect(isNoticeable(sighting({ build: aircraftBuild('C172'), distanceKm: 2.5 }))).toBe(false);
  });

  it('notices a 787 farther away than a 737 at the same spot', () => {
    const far = { distanceKm: 5, altitudeFt: 10_000 };
    expect(isNoticeable(sighting({ ...far, build: aircraftBuild('B789') }))).toBe(true);
    expect(isNoticeable(sighting({ ...far, build: aircraftBuild('B738') }))).toBe(false);
  });

  it('hears a low airliner that buildings hide from view', () => {
    expect(isNoticeable(sighting({ distanceKm: 1.5, altitudeFt: 850 }))).toBe(true);
  });

  it('does not notice a plane low on the horizon far away', () => {
    expect(isNoticeable(sighting({ distanceKm: 8, altitudeFt: 1600 }))).toBe(false);
  });
});

describe('aircraftBuild', () => {
  it('knows a widebody by its type', () => {
    expect(aircraftBuild('A332')).toEqual(aircraftBuild('B789'));
  });

  it('falls back to the ADS-B category for an unknown type', () => {
    expect(aircraftBuild('GLF4', 'A2').sizeM).toBeLessThan(aircraftBuild('B738').sizeM);
    expect(aircraftBuild('R44', 'A7')).toEqual(aircraftBuild('EC35', 'A7'));
  });

  it('treats an unknown type with no category as an airliner', () => {
    expect(aircraftBuild('ZZZZ')).toEqual(aircraftBuild('A320'));
  });
});
