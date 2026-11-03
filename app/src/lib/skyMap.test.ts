import { readFileSync } from 'node:fs';
import type { NearbyPlane } from '@overhead/shared';
import { describe, expect, it } from 'vitest';
import { KM_PER_NM } from './format';
import { MAP, northLabelPosition, placePlane, PLANE_ICON, ringStepKm, zoomFor } from './skyMap';

const plane = (overrides: Partial<NearbyPlane>): NearbyPlane => ({
  id: 'abc',
  flight: 'ELY001',
  altitudeFt: 3000,
  trackDeg: 0,
  distanceNm: 1,
  bearingDeg: 0,
  stage: 'overhead',
  route: null,
  ...overrides,
});

const km = (distanceKm: number) => distanceKm / KM_PER_NM;
const offset = ({ x, y }: { x: number; y: number }) => ({ right: x - MAP.center.x, up: MAP.center.y - y });
const onMap = ({ x, y }: { x: number; y: number }) => x >= 0 && x <= MAP.width && y >= 0 && y <= MAP.height;

describe('map zoom', () => {
  it.each([
    [0.4, 1],
    [2.8, 1],
    [3.2, 2],
    [5.9, 2],
    [7.5, 5],
    [14, 5],
    [18, 10],
    [60, 10],
  ])('fits a plane %f km away with rings every %i km', (distanceKm, stepKm) => {
    expect(ringStepKm(distanceKm)).toBe(stepKm);
  });
});

describe('what the map zooms to', () => {
  it('stays at 1 km rings when the sky is empty', () => {
    expect(zoomFor([])).toEqual({ stepKm: 1, shown: [] });
  });

  it('zooms out to fit a plane that is approaching from 6 km away', () => {
    const approaching = plane({ stage: 'approaching', distanceNm: km(6) });
    expect(zoomFor([approaching])).toEqual({ stepKm: 2, shown: [approaching] });
  });

  it('does not zoom out for planes still on their way, and leaves off the ones that do not fit', () => {
    const overhead = plane({ id: 'near', stage: 'overhead', distanceNm: km(1.5) });
    const inboundNear = plane({ id: 'soon', stage: 'inbound', distanceNm: km(2.5) });
    const inboundFar = plane({ id: 'far', stage: 'inbound', distanceNm: km(15) });

    expect(zoomFor([overhead, inboundNear, inboundFar])).toEqual({
      stepKm: 1,
      shown: [overhead, inboundNear],
    });
  });
});

describe('where a plane is drawn', () => {
  it('draws a plane north of you straight up when you face north', () => {
    const { right, up } = offset(placePlane(plane({ bearingDeg: 0, distanceNm: km(1) }), 0, 1));
    expect(right).toBeCloseTo(0);
    expect(up).toBeCloseTo(MAP.ringSpacingPx);
  });

  it('draws a plane east of you to the right when you face north', () => {
    const { right, up } = offset(placePlane(plane({ bearingDeg: 90, distanceNm: km(2) }), 0, 1));
    expect(right).toBeCloseTo(2 * MAP.ringSpacingPx);
    expect(up).toBeCloseTo(0);
  });

  it('turns the map with you: a plane east of you is straight ahead when you face east', () => {
    const { right, up } = offset(placePlane(plane({ bearingDeg: 90, distanceNm: km(1) }), 90, 1));
    expect(right).toBeCloseTo(0);
    expect(up).toBeCloseTo(MAP.ringSpacingPx);
  });

  it('puts a plane north of you on your left when you face east', () => {
    const { right, up } = offset(placePlane(plane({ bearingDeg: 0, distanceNm: km(1) }), 90, 1));
    expect(right).toBeCloseTo(-MAP.ringSpacingPx);
    expect(up).toBeCloseTo(0);
  });

  it('puts a plane on the ring that matches its distance', () => {
    const { right, up } = offset(placePlane(plane({ bearingDeg: 135, distanceNm: km(4) }), 0, 2));
    expect(Math.hypot(right, up)).toBeCloseTo(2 * MAP.ringSpacingPx);
  });

  it.each([0, 45, 90, 135, 180, 225, 270, 315])(
    'keeps every card plane on the map, from 0.1 to 9 km away, at bearing %i°',
    (bearingDeg) => {
      for (const distanceKm of [0.1, 1, 2.8, 4, 6, 9]) {
        const shown = plane({ bearingDeg, distanceNm: km(distanceKm) });
        expect(onMap(placePlane(shown, 30, ringStepKm(distanceKm)))).toBe(true);
      }
    },
  );
});

describe('which way a plane points', () => {
  it.each([
    [90, 0, 90],
    [0, 0, 0],
    [270, 90, 180],
    [45, 45, 0],
  ])('a plane flying %i° while you face %i° points %i° on screen', (trackDeg, headingDeg, screenDeg) => {
    expect(placePlane(plane({ trackDeg }), headingDeg, 1).rotation).toBeCloseTo(screenDeg);
  });

  it('the icon artwork points north-east before it is turned', () => {
    const [noseX, noseY] = PLANE_ICON.nose;
    const centre = PLANE_ICON.size / 2;
    const artworkDeg = (Math.atan2(noseX - centre, centre - noseY) * 180) / Math.PI;
    expect(artworkDeg).toBeCloseTo(PLANE_ICON.noseDeg);
  });
});

describe('the N marker', () => {
  it('sits at the top when you face north and on the left when you face east', () => {
    expect(offset(northLabelPosition(0)).right).toBeCloseTo(0);
    expect(offset(northLabelPosition(0)).up).toBeGreaterThan(0);
    expect(offset(northLabelPosition(90)).right).toBeLessThan(0);
    expect(offset(northLabelPosition(90)).up).toBeCloseTo(0);
  });
});

describe('a real flight on the map: Israir ISR053 over Ramat Gan', () => {
  const { samples } = JSON.parse(
    readFileSync(
      new URL('../../../server/test/fixtures/isr053-climb-over-ramat-gan.json', import.meta.url),
      'utf8',
    ),
  ) as {
    samples: (Pick<NearbyPlane, 'distanceNm' | 'bearingDeg' | 'trackDeg' | 'altitudeFt'> & {
      time: string;
    })[];
  };
  const onTheCard = samples.filter(({ distanceNm }) => distanceNm * KM_PER_NM <= 4.5);

  it.each([0, 90, 200])('draws every point of the pass on screen while you face %i°', (headingDeg) => {
    const farthestKm = Math.max(...onTheCard.map(({ distanceNm }) => distanceNm * KM_PER_NM));
    for (const sample of onTheCard) {
      expect(onMap(placePlane(plane(sample), headingDeg, ringStepKm(farthestKm)))).toBe(true);
    }
  });

  it('draws each point in the plane real direction from you', () => {
    for (const sample of onTheCard) {
      const { right, up } = offset(placePlane(plane(sample), 0, ringStepKm(5)));
      const drawnDeg = ((Math.atan2(right, up) * 180) / Math.PI + 360) % 360;
      expect(Math.abs(((drawnDeg - sample.bearingDeg + 540) % 360) - 180)).toBeLessThan(0.5);
    }
    expect(onTheCard.length).toBeGreaterThan(20);
  });
});
