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

const NM_IN_KM = 1.852;

function bearingAndDistance(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const east = radians(to.lon - from.lon) * Math.cos(radians((from.lat + to.lat) / 2));
  const north = radians(to.lat - from.lat);
  return {
    bearingDeg: ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360,
    distanceNm: (Math.hypot(east, north) * 6371) / NM_IN_KM,
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('a real adsb.fi response captured over Ben Gurion', () => {
  it('keeps the airborne aircraft and drops the ones on the ground', () => {
    const flights = parseReadsbResponse(capturedOverBenGurion).map(({ flight }) => flight);
    expect(flights.sort()).toEqual(['4XHSC', 'RJA264']);
  });

  it('reads each plane direction from you and distance in nautical miles, matching its real coordinates', () => {
    const { ac } = capturedOverBenGurion as { ac: { flight?: string; lat: number; lon: number }[] };
    const parsed = parseReadsbResponse(capturedOverBenGurion);

    for (const plane of parsed) {
      const raw = ac.find(({ flight }) => flight?.trim() === plane.flight);
      const expected = bearingAndDistance(BEN_GURION, raw ?? BEN_GURION);
      expect(plane.bearingDeg).toBeCloseTo(expected.bearingDeg, 0);
      expect(plane.distanceNm).toBeCloseTo(expected.distanceNm, 1);
    }
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('reads altitude, speed and position in the units the geometry expects', () => {
    const microlight = parseReadsbResponse(capturedOverBenGurion).find(({ flight }) => flight === '4XHSC');
    expect(microlight).toMatchObject({ typeCode: 'EV97', altitudeFt: 275 });
    expect(microlight?.groundSpeedKt).toBeCloseTo(94.4);
    expect(microlight?.distanceNm).toBeCloseTo(7.61, 1);
  });
});

describe('position feeds', () => {
  it('asks adsb.fi first for the 10 km area around the user, wide enough to cover their circle', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ ac: [] }));
    await createPositionSource(fetchFn).aircraftNear(BEN_GURION, 3);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe(
      'https://opendata.adsb.fi/api/v3/lat/32.05/lon/34.85/dist/7.5',
    );
  });

  it('measures each plane from the user, not from the middle of the area', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(capturedOverBenGurion));
    const parsed = parseReadsbResponse(capturedOverBenGurion);
    const aircraft = await createPositionSource(fetchFn).aircraftNear(BEN_GURION, 10);

    for (const plane of aircraft) {
      const expected = bearingAndDistance(BEN_GURION, parsed.find(({ id }) => id === plane.id) ?? BEN_GURION);
      expect(plane.distanceNm).toBeCloseTo(expected.distanceNm, 1);
      expect(plane.bearingDeg).toBeCloseTo(expected.bearingDeg, 0);
    }
    expect(aircraft.length).toBeGreaterThan(0);
  });

  it("fetches an area once for everyone in it and leaves out planes beyond each user's circle", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(capturedOverBenGurion));
    const positions = createPositionSource(fetchFn);
    const [near, wide] = await Promise.all([
      positions.aircraftNear(BEN_GURION, 3),
      positions.aircraftNear({ lat: 32.01, lon: 34.89 }, 3),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(near.every(({ distanceNm }) => distanceNm <= 3)).toBe(true);
    expect(wide.every(({ distanceNm }) => distanceNm <= 3)).toBe(true);
  });

  it('waits a second between calls to the same feed, as adsb.fi asks', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => json({ ac: [] }));
    const positions = createPositionSource(fetchFn, { now: Date.now });
    const first = positions.aircraftNear(BEN_GURION, 3);
    const second = positions.aircraftNear({ lat: 31.5, lon: 34.5 }, 3);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);
    vi.useRealTimers();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('falls back to adsb.lol when adsb.fi rate-limits us', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json(capturedOverBenGurion));

    const aircraft = await createPositionSource(fetchFn).aircraftNear(BEN_GURION, 10);

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

  const noRoutes: RouteSource = { routeFor: async () => null };

  it('counts planes overhead first, then planes approaching, nearest first', async () => {
    const sky = createSky(
      fixedFeed([
        aircraft('CRUISE1', { altitudeFt: 37000, distanceNm: 0.2 }),
        aircraft('AWAY1', { distanceNm: 2.4, bearingDeg: 90, trackDeg: 90 }),
        aircraft('INBOUND1', { distanceNm: 2.4, bearingDeg: 90, trackDeg: 270, groundSpeedKt: 240 }),
        aircraft('ETD597', { distanceNm: 1.1 }),
        aircraft('ELY001', { distanceNm: 0.4 }),
      ]),
      knownRoutes(),
    );

    const planes = await sky.planesAbove(BEN_GURION);

    expect(planes.map(({ flight, stage }) => `${flight}:${stage}`)).toEqual([
      'ELY001:overhead',
      'ETD597:overhead',
      'INBOUND1:approaching',
    ]);
  });

  it('only spends route lookups on planes that will pass over you', async () => {
    const routes = knownRoutes();
    const sky = createSky(
      fixedFeed([aircraft('CRUISE1', { altitudeFt: 37000 }), aircraft('ELY001', { distanceNm: 0.4 })]),
      routes,
    );

    await sky.planesAbove(BEN_GURION);

    expect(routes.asked).toEqual(['ELY001']);
  });

  it('names the airline and the aircraft', async () => {
    const sky = createSky(fixedFeed([aircraft('ISR053', { typeCode: 'A320' })]), knownRoutes());

    const [plane] = await sky.planesAbove(BEN_GURION);

    expect(plane).toMatchObject({ airline: 'Israir', aircraft: 'A320', route: { to: 'TLV' } });
  });

  it('adds planes passing too far for the close rule when they are loud enough to hear', async () => {
    const farPast = { distanceNm: 2.4, bearingDeg: 0, trackDeg: 270 };
    const noise = { peakDb: (plane: Aircraft) => (plane.flight === 'LOUD1' ? 52 : 40) };
    const sky = createSky(
      fixedFeed([aircraft('LOUD1', farPast), aircraft('QUIET1', farPast), aircraft('ELY001', {})]),
      noRoutes,
      noise,
    );

    const planes = await sky.planesAbove(BEN_GURION);

    expect(planes.map(({ flight, stage, heardDb }) => ({ flight, stage, heardDb }))).toEqual([
      { flight: 'ELY001', stage: 'overhead', heardDb: undefined },
      { flight: 'LOUD1', stage: 'overhead', heardDb: 52 },
    ]);
  });

  it('keeps a plane whose route is unknown, with what we do know', async () => {
    const sky = createSky(fixedFeed([aircraft('4XCDO', { typeCode: 'C25A' })]), noRoutes);

    const [plane] = await sky.planesAbove(BEN_GURION);

    expect(plane).toMatchObject({ flight: '4XCDO', aircraft: 'C25A', route: null, stage: 'overhead' });
    expect(plane?.airline).toBeUndefined();
  });
});
