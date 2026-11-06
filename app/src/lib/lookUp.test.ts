import { readFileSync } from 'node:fs';
import type { NearbyPlane } from '@overhead/shared';
import { describe, expect, it } from 'vitest';
import { KM_PER_NM } from './format';
import { describeDirection, elevationAngle, lookUpGuide, relativeBearing, tapsWhenFacing } from './lookUp';

type TrackSample = Pick<NearbyPlane, 'distanceNm' | 'bearingDeg' | 'trackDeg' | 'altitudeFt'> & {
  time: string;
};

const { samples: isr053 } = JSON.parse(
  readFileSync(
    new URL('../../../server/test/fixtures/isr053-climb-over-ramat-gan.json', import.meta.url),
    'utf8',
  ),
) as { samples: TrackSample[] };

const plane = (overrides: Partial<NearbyPlane>): NearbyPlane => ({
  id: 'abc',
  flight: 'WUK79',
  altitudeFt: 1050,
  trackDeg: 0,
  distanceNm: 8.7 / KM_PER_NM,
  bearingDeg: 0,
  stage: 'approaching',
  route: null,
  ...overrides,
});

function turnAround(target: NearbyPlane, fromDeg: number, toDeg: number) {
  const taps: number[] = [];
  let wasFacing = false;
  for (let heading = fromDeg; heading <= toDeg; heading += 1) {
    const { facing } = lookUpGuide(target, heading % 360);
    if (tapsWhenFacing(wasFacing, facing)) taps.push(heading % 360);
    wasFacing = facing;
  }
  return taps;
}

describe('Look Up, with the WUK79 approach from the screenshot', () => {
  const wuk79 = plane({ bearingDeg: 68 });

  it('says ahead and to the left, 2° up, when the plane is 22° to your left', () => {
    const guide = lookUpGuide(wuk79, 90);
    expect(guide).toMatchObject({ direction: 'Ahead and to the left', elevationDeg: 2, facing: false });
    expect(guide.arrowDeg).toBeCloseTo(-22);
  });

  it('points straight up and says straight ahead once you face it', () => {
    expect(lookUpGuide(wuk79, 68)).toMatchObject({ arrowDeg: 0, direction: 'Straight ahead', facing: true });
  });

  it('points down and says behind you when you face away from it', () => {
    const guide = lookUpGuide(wuk79, 248);
    expect(guide.direction).toBe('Behind you');
    expect(Math.abs(guide.arrowDeg)).toBe(180);
  });
});

describe('turning to find the plane', () => {
  it('taps once as you turn to face it', () => {
    expect(turnAround(plane({ bearingDeg: 120 }), 0, 359)).toEqual([111]);
  });

  it('taps once even when the plane is just past north and you turn through 0°', () => {
    expect(turnAround(plane({ bearingDeg: 5 }), 300, 400)).toEqual([356]);
  });

  it('taps again only after you have turned away and come back', () => {
    const target = plane({ bearingDeg: 120 });
    expect(turnAround(target, 0, 359 + 360)).toEqual([111, 111]);
  });
});

describe('a real flight: Israir ISR053 climbing over Ramat Gan', () => {
  const overhead = isr053.filter(({ distanceNm }) => distanceNm * KM_PER_NM <= 2.8);
  const closest = isr053.reduce((best, sample) => (sample.distanceNm < best.distanceNm ? sample : best));

  it('tells you to look almost straight up when it is right above you', () => {
    expect(lookUpGuide(plane(closest), 0).elevationDeg).toBeGreaterThan(75);
  });

  it('tells you to look higher as it gets closer, then lower as it leaves', () => {
    const angles = overhead.map((sample) => lookUpGuide(plane(sample), 0).elevationDeg);
    const peak = angles.indexOf(Math.max(...angles));
    expect(angles.slice(0, peak + 1)).toEqual([...angles.slice(0, peak + 1)].sort((a, b) => a - b));
    expect(angles.slice(peak)).toEqual([...angles.slice(peak)].sort((a, b) => b - a));
  });

  it('keeps the arrow on the plane: facing its bearing always means straight ahead', () => {
    for (const sample of overhead) {
      expect(lookUpGuide(plane(sample), sample.bearingDeg)).toMatchObject({ arrowDeg: 0, facing: true });
    }
  });

  it('turns the arrow by exactly how far you are turned away from the plane', () => {
    for (const sample of overhead) {
      for (const offset of [-150, -60, -15, 15, 60, 150]) {
        const heading = (sample.bearingDeg - offset + 360) % 360;
        expect(lookUpGuide(plane(sample), heading).arrowDeg).toBeCloseTo(offset);
      }
    }
  });
});

describe('angles and directions', () => {
  it('points 33° up for a plane at 2,600 ft, 1.2 km away', () => {
    expect(elevationAngle(2600, 1.2 / KM_PER_NM)).toBe(33);
  });

  it('points straight up for a plane right above you', () => {
    expect(elevationAngle(3000, 0)).toBe(90);
  });

  it('points low for a plane far away near the horizon', () => {
    expect(elevationAngle(1500, 2.5 / KM_PER_NM)).toBe(10);
  });

  it('turns the plane bearing into a direction relative to where the phone faces', () => {
    expect(relativeBearing(45, 0)).toBe(45);
    expect(relativeBearing(10, 350)).toBe(20);
    expect(relativeBearing(350, 10)).toBe(-20);
    expect(relativeBearing(180, 0)).toBe(-180);
  });

  it.each([
    [0, 'Straight ahead'],
    [-15, 'Straight ahead'],
    [45, 'Ahead and to the right'],
    [-45, 'Ahead and to the left'],
    [90, 'To your right'],
    [-100, 'To your left'],
    [135, 'Behind you, to the right'],
    [175, 'Behind you'],
    [-180, 'Behind you'],
  ])('says %i° is "%s"', (relativeDeg, phrase) => {
    expect(describeDirection(relativeDeg)).toBe(phrase);
  });
});
