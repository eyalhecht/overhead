import { describe, expect, it } from 'vitest';
import { parseReadsbResponse } from '../src/flights/positions.js';

describe('parseReadsbResponse', () => {
  it('keeps named, airborne aircraft and maps them to our shape', () => {
    const aircraft = parseReadsbResponse({
      ac: [
        { hex: 'abc', flight: 'BAW982  ', t: 'A20N', alt_baro: 3400, gs: 140, track: 250, dst: 0.8, dir: 70 },
        { hex: 'def', flight: 'DLH1', alt_baro: 'ground', dst: 0.2, dir: 10 },
        { hex: 'ghi', flight: '   ', alt_baro: 2000, dst: 0.5, dir: 10 },
      ],
    });

    expect(aircraft).toEqual([
      {
        id: 'abc',
        flight: 'BAW982',
        typeCode: 'A20N',
        altitudeFt: 3400,
        groundSpeedKt: 140,
        trackDeg: 250,
        distanceNm: 0.8,
        bearingDeg: 70,
      },
    ]);
  });

  it('prefers GPS altitude, since pressure altitude drifts with the weather', () => {
    const [plane] = parseReadsbResponse({
      ac: [{ hex: 'abc', flight: 'BAW16', alt_baro: 525, alt_geom: 925, baro_rate: -700, dst: 1, dir: 0 }],
    });
    expect(plane?.altitudeFt).toBe(925);
    expect(plane?.verticalRateFpm).toBe(-700);
  });

  it('still uses pressure altitude when there is no GPS altitude', () => {
    const [plane] = parseReadsbResponse({
      ac: [{ hex: 'abc', flight: 'BAW16', alt_baro: 525, dst: 1, dir: 0 }],
    });
    expect(plane?.altitudeFt).toBe(525);
  });

  it('treats a missing aircraft list as an empty sky', () => {
    expect(parseReadsbResponse({})).toEqual([]);
  });
});
