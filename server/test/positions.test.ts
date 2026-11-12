import { describe, expect, it } from 'vitest';
import { parseReadsbResponse } from '../src/flights/positions.js';

describe('parseReadsbResponse', () => {
  it('keeps named, airborne aircraft and maps them to our shape', () => {
    const aircraft = parseReadsbResponse({
      ac: [
        {
          hex: 'abc',
          flight: 'BAW982  ',
          t: 'A20N',
          alt_baro: 3400,
          gs: 140,
          track: 250,
          lat: 51.47,
          lon: -0.45,
          dst: 0.8,
          dir: 70,
        },
        { hex: 'def', flight: 'DLH1', alt_baro: 'ground', dst: 0.2, dir: 10 },
        { hex: 'ghi', flight: '   ', alt_baro: 2000, dst: 0.5, dir: 10 },
      ],
    });

    expect(aircraft).toEqual([
      {
        id: 'abc',
        lat: 51.47,
        lon: -0.45,
        flight: 'BAW982',
        typeCode: 'A20N',
        altitudeFt: 3400,
        groundSpeedKt: 140,
        trackDeg: 250,
      },
    ]);
  });

  it('drops planes on the ground, even when the feed still gives their last flying speed', () => {
    const aircraft = parseReadsbResponse({
      ac: [
        { hex: 'a1', flight: 'UAL32', t: 'B789', alt_baro: 0, gs: 108, lat: 33.95, lon: -118.4 },
        { hex: 'a2', flight: 'SWA410', t: 'B38M', alt_baro: 'ground', gs: 0, lat: 33.95, lon: -118.4 },
        { hex: 'a3', flight: 'UAL360', t: 'B752', alt_baro: 100, gs: 107, lat: 33.95, lon: -118.4 },
        { hex: 'a4', flight: 'ELY2', t: 'B789', alt_baro: -150, gs: 140, lat: 32.0, lon: 34.8 },
      ],
    });

    expect(aircraft.map((plane) => plane.flight)).toEqual(['UAL360', 'ELY2']);
  });

  it('drops positions too old to place the plane, and keeps planes without an age', () => {
    const aircraft = parseReadsbResponse({
      ac: [
        { hex: 'b1', flight: 'DAL867', alt_baro: 1200, gs: 136, lat: 33.95, lon: -118.4, seen_pos: 43.5 },
        {
          hex: 'b2',
          flight: 'AAL2100',
          alt_baro: 1200,
          gs: 140,
          lat: 33.95,
          lon: -118.4,
          seen: 30,
          seen_pos: 2,
        },
        { hex: 'b3', flight: 'SKW5820', alt_baro: 900, gs: 140, lat: 33.95, lon: -118.4, seen: 20 },
        { hex: 'b4', flight: 'QXE2278', alt_baro: 800, gs: 130, lat: 33.95, lon: -118.4 },
      ],
    });

    expect(aircraft.map((plane) => plane.flight)).toEqual(['AAL2100', 'QXE2278']);
  });

  it('treats a missing aircraft list as an empty sky', () => {
    expect(parseReadsbResponse({})).toEqual([]);
  });
});
