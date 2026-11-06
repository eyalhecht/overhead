import { describe, expect, it } from 'vitest';
import { heardStage, type Aircraft } from '../src/flights/geometry.js';
import { createNoiseModel, type NoiseTables } from '../src/flights/noise.js';

// Made-up tables in the EASA ANP layout. The real data is downloaded at deploy and never stored here.
const DISTANCES_FT = [200, 400, 630, 1000, 2000, 4000, 6300, 10_000, 16_000, 25_000];
const npdRow = (mode: 'A' | 'D', power: number) => [
  'FAKE1',
  'LAmax',
  mode,
  String(power),
  ...DISTANCES_FT.map((feet) => (90 + power / 1000 - 22 * Math.log10(feet / 200)).toFixed(1)),
];

const tables: NoiseTables = {
  aircraft: [
    [
      '737800',
      'Made-up twin jet',
      'Jet',
      '2',
      'Large',
      'Commercial',
      '170000',
      '145000',
      '6000',
      '26000',
      '4',
      'FAKE1',
      'CNT (lb)',
      '1',
      '1',
      'Wing',
    ],
  ],
  npd: [npdRow('A', 3000), npdRow('A', 8000), npdRow('D', 10_000), npdRow('D', 24_000)],
  engines: [
    ['737800', 'MaxClimb', '22000', '-25', '0.3', '0'],
    ['737800', 'MaxTakeoff', '26000', '-29', '0.1', '0'],
  ],
  aerodynamics: [
    ['737800', 'D', '5', '', '', '', '0.06'],
    ['737800', 'A', '30', '', '', '', '0.12'],
  ],
  weights: [['737800', '2', '150000']],
};

const model = createNoiseModel(tables);
const plane = (overrides: Partial<Aircraft> = {}): Aircraft => ({
  id: '738288',
  flight: 'ISR725',
  typeCode: 'B738',
  altitudeFt: 4900,
  verticalRateFpm: 2000,
  groundSpeedKt: 230,
  trackDeg: 90,
  distanceNm: 1.9,
  bearingDeg: 0,
  ...overrides,
});

describe('noise model', () => {
  it('hears a plane climbing at takeoff power louder than one gliding in at the same spot', () => {
    const climbing = model.peakDb(plane());
    const landing = model.peakDb(plane({ verticalRateFpm: -800, groundSpeedKt: 170 }));

    expect(climbing).toBeGreaterThan((landing ?? 0) + 5);
  });

  it('hears a plane high overhead louder than one as far away but low on the horizon', () => {
    const overhead = model.peakDb(plane({ altitudeFt: 12_000, distanceNm: 0 }));
    const lowAndFar = model.peakDb(plane({ altitudeFt: 1000, distanceNm: 12_000 / 6076 }));

    expect(overhead).toBeGreaterThan((lowAndFar ?? 0) + 3);
  });

  it('gets quieter the farther away the plane passes', () => {
    expect(model.peakDb(plane({ distanceNm: 1 }))).toBeGreaterThan(
      model.peakDb(plane({ distanceNm: 3 })) ?? 0,
    );
  });

  it('does not guess for aircraft types it has no noise data for', () => {
    expect(model.peakDb(plane({ typeCode: 'H25B' }))).toBeUndefined();
    expect(model.peakDb(plane({ typeCode: undefined }))).toBeUndefined();
  });
});

describe('heardStage', () => {
  const passing = (secondsAway: number) =>
    plane({ distanceNm: (230 * secondsAway) / 3600, bearingDeg: 270, trackDeg: 90 });

  it('follows a loud plane from inbound to approaching to above you', () => {
    expect(heardStage(passing(100), 55)).toBe('inbound');
    expect(heardStage(passing(30), 55)).toBe('approaching');
    expect(heardStage(passing(5), 55)).toBe('overhead');
  });

  it('ignores planes quieter than a city street and planes it cannot judge', () => {
    expect(heardStage(passing(30), 44)).toBeNull();
    expect(heardStage(passing(30), undefined)).toBeNull();
  });
});
