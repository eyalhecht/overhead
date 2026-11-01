import { readFileSync } from 'node:fs';
import type { Route } from '@overhead/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Aircraft } from '../src/flights/geometry.js';
import { createPositionSource, parseReadsbResponse, type PositionSource } from '../src/flights/positions.js';
import type { RouteSource } from '../src/flights/routes.js';
import { createSky } from '../src/flights/sky.js';

const BEN_GURION = { lat: 32.0055, lon: 34.8854 };
const capturedOverBenGurion: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/adsbfi-ben-gurion.json', import.meta.url), 'utf8'),
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('a real adsb.fi response captured over Ben Gurion', () => {
  it('keeps the airborne aircraft and drops the ones on the ground', () => {
    const flights = parseReadsbResponse(capturedOverBenGurion).map(({ flight }) => flight);
    expect(flights.sort()).toEqual(['4XHSC', 'RJA264']);
  });

  it('reads altitude, speed and position in the units the geometry expects', () => {
    const microlight = parseReadsbResponse(capturedOverBenGurion).find(({ flight }) => flight === '4XHSC');
    expect(microlight).toMatchObject({ typeCode: 'EV97', altitudeFt: 275 });
    expect(microlight?.groundSpeedKt).toBeCloseTo(94.4);
    expect(microlight?.distanceNm).toBeCloseTo(7.61, 1);
  });
});

describe('position feeds', () => {
  it('asks adsb.fi first for the circle around the user', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ ac: [] }));
    await createPositionSource(fetchFn).aircraftNear(BEN_GURION, 3);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe(
      'https://opendata.adsb.fi/api/v3/lat/32.0055/lon/34.8854/dist/3',
    );
  });

  it('falls back to adsb.lol when adsb.fi rate-limits us', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json(capturedOverBenGurion));

    const aircraft = await createPositionSource(fetchFn).aircraftNear(BEN_GURION, 3);

    expect(String(fetchFn.mock.calls[1]?.[0])).toContain('api.adsb.lol');
    expect(aircraft).toHaveLength(2);
  });

  it('falls back to adsb.lol when adsb.fi does not answer in time', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      .mockResolvedValueOnce(json({ ac: [] }));

    await expect(createPositionSource(fetchFn).aircraftNear(BEN_GURION, 3)).resolves.toEqual([]);
  });

  it('explains which feeds failed when none of them work', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 503))
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.adsb.lol'));

    await expect(createPositionSource(fetchFn).aircraftNear(BEN_GURION, 3)).rejects.toThrow(
      /adsb\.fi responded 503.*adsb\.lol failed: getaddrinfo ENOTFOUND/,
    );
  });
});

describe('the sky above a user', () => {
  const aircraft = (flight: string, overrides: Partial<Aircraft>): Aircraft => ({
    id: flight.toLowerCase(),
    flight,
    altitudeFt: 3000,
    groundSpeedKt: 150,
    trackDeg: 300,
    distanceNm: 0.5,
    bearingDeg: 120,
    ...overrides,
  });

  const fixedFeed = (list: Aircraft[]): PositionSource => ({ aircraftNear: async () => list });
  const knownRoutes = (): RouteSource & { asked: string[] } => {
    const asked: string[] = [];
    return {
      asked,
      async routeFor(flight) {
        asked.push(flight);
        return { from: 'AUH', fromCity: 'Abu Dhabi', to: 'TLV', toCity: 'Tel Aviv' } satisfies Route;
      },
    };
  };

  it('only counts planes that are low and close, nearest first', async () => {
    const routes = knownRoutes();
    const sky = createSky(
      fixedFeed([
        aircraft('CRUISE1', { altitudeFt: 37000, distanceNm: 0.2 }),
        aircraft('FAR1', { distanceNm: 2.4 }),
        aircraft('ETD597', { distanceNm: 1.1 }),
        aircraft('ELY001', { distanceNm: 0.4 }),
      ]),
      routes,
    );

    const planes = await sky.planesAbove(BEN_GURION);

    expect(planes.map(({ flight }) => flight)).toEqual(['ELY001', 'ETD597']);
  });

  it('only spends route lookups on planes that are actually overhead', async () => {
    const routes = knownRoutes();
    const sky = createSky(
      fixedFeed([aircraft('CRUISE1', { altitudeFt: 37000 }), aircraft('ELY001', { distanceNm: 0.4 })]),
      routes,
    );

    await sky.planesAbove(BEN_GURION);

    expect(routes.asked).toEqual(['ELY001']);
  });

  it('puts friendly aircraft names and a countdown on each plane', async () => {
    const sky = createSky(
      fixedFeed([aircraft('UAL90', { typeCode: 'B789', groundSpeedKt: 120, distanceNm: 0, trackDeg: 90 })]),
      knownRoutes(),
    );

    const [plane] = await sky.planesAbove(BEN_GURION);

    expect(plane).toMatchObject({ aircraft: '787-9', secondsLeft: 45, route: { to: 'TLV' } });
  });
});
