import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { passStage, type Aircraft } from '../src/flights/geometry.js';

interface TrackSample extends Pick<
  Aircraft,
  'altitudeFt' | 'groundSpeedKt' | 'trackDeg' | 'distanceNm' | 'bearingDeg'
> {
  time: string;
}

const isr053: { samples: TrackSample[] } = JSON.parse(
  readFileSync(new URL('./fixtures/isr053-climb-over-ramat-gan.json', import.meta.url), 'utf8'),
);

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

const secondsBetween = (from: string, to: string) =>
  (Date.parse(`2026-11-03T${to}Z`) - Date.parse(`2026-11-03T${from}Z`)) / 1000;

describe('passStage', () => {
  it('is overhead for a low plane inside the circle', () => {
    expect(passStage(aircraft({ distanceNm: 1.2, altitudeFt: 5500 }))).toBe('overhead');
  });

  it('is approaching for a plane that comes into view within 10 seconds', () => {
    const plane = aircraft({ distanceNm: 1.6, bearingDeg: 90, trackDeg: 270, groundSpeedKt: 240 });
    expect(passStage(plane)).toBe('approaching');
  });

  it('is inbound for a plane that comes into view within two minutes, but not in 10 seconds', () => {
    const plane = aircraft({ distanceNm: 6, bearingDeg: 90, trackDeg: 270, groundSpeedKt: 240 });
    expect(passStage(plane)).toBe('inbound');
  });

  it('ignores a plane that will pass over you, but not for a few minutes', () => {
    const plane = aircraft({ distanceNm: 12, bearingDeg: 90, trackDeg: 270, groundSpeedKt: 240 });
    expect(passStage(plane)).toBeNull();
  });

  it('ignores a plane that will pass by, but not close enough', () => {
    const plane = aircraft({ distanceNm: 2, bearingDeg: 0, trackDeg: 90, groundSpeedKt: 240 });
    expect(passStage(plane)).toBeNull();
  });

  it('ignores a plane flying away from you', () => {
    expect(passStage(aircraft({ distanceNm: 2, bearingDeg: 90, trackDeg: 90 }))).toBeNull();
  });

  it('ignores an airliner cruising high above you', () => {
    expect(passStage(aircraft({ altitudeFt: 35_000 }))).toBeNull();
  });

  it('shows an airliner at 10,500 ft right above you, which is still easy to see', () => {
    expect(passStage(aircraft({ altitudeFt: 10_500 }))).toBe('overhead');
  });

  it('expects a descending plane to come into view as it gets lower', () => {
    const inbound = { altitudeFt: 16_000, distanceNm: 3, bearingDeg: 90, trackDeg: 270, groundSpeedKt: 240 };
    expect(passStage(aircraft(inbound))).toBeNull();
    expect(passStage(aircraft({ ...inbound, verticalRateFpm: -2500 }))).toBe('inbound');
  });

  it('ignores a hovering helicopter right above you', () => {
    expect(passStage(aircraft({ groundSpeedKt: 5, altitudeFt: 800 }))).toBeNull();
  });
});

describe('a real departure: Israir ISR053 climbing over Ramat Gan', () => {
  const stages = isr053.samples.map((sample) => ({ time: sample.time, stage: passStage(aircraft(sample)) }));
  const closest = isr053.samples.reduce((best, sample) =>
    sample.distanceNm < best.distanceNm ? sample : best,
  );

  it('is approaching about 30 seconds ahead, even while still turning onto its course', () => {
    const firstSeen = stages.find(({ stage }) => stage === 'approaching' || stage === 'overhead');
    const leadSeconds = secondsBetween(firstSeen?.time ?? closest.time, closest.time);

    expect(firstSeen?.stage).toBe('approaching');
    expect(leadSeconds).toBeGreaterThanOrEqual(25);
    expect(leadSeconds).toBeLessThanOrEqual(60);
  });

  it('stays on the card from the first sighting until it leaves the circle', () => {
    const firstSeen = stages.findIndex(({ stage }) => stage === 'approaching');
    const lastOverhead = stages.map(({ stage }) => stage).lastIndexOf('overhead');

    const onCard = stages.slice(firstSeen, lastOverhead + 1);
    expect(onCard.every(({ stage }) => stage === 'approaching' || stage === 'overhead')).toBe(true);
  });

  it('is overhead while it climbs past 6,000 ft right above you', () => {
    const climbingPast6000 = isr053.samples.find((sample) => sample.altitudeFt > 6000);
    expect(passStage(aircraft(climbingPast6000))).toBe('overhead');
  });
});
