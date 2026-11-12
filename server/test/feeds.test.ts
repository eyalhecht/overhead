import { readFileSync } from 'node:fs';
import type { GeoPoint, Route } from '@overhead/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Aircraft } from '../src/flights/geometry.js';
import {
  adsbLol,
  createPositionSource,
  flyItalyAdsb,
  parseReadsbResponse,
  tileAt,
  type PositionSource,
} from '../src/flights/positions.js';
import type { RouteSource } from '../src/flights/routes.js';
import { createSky } from '../src/flights/sky.js';

const BEN_GURION = { lat: 32.0055, lon: 34.8854 };
const capturedOverBenGurion: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/readsb-ben-gurion.json', import.meta.url), 'utf8'),
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

describe('a real readsb response captured over Ben Gurion', () => {
  it('keeps the airborne aircraft and drops the ones on the ground', () => {
    const flights = parseReadsbResponse(capturedOverBenGurion).map(({ flight }) => flight);
    expect(flights.sort()).toEqual(['4XHSC', 'RJA264']);
  });

  it('reads altitude, speed and position in the units the geometry expects', () => {
    const microlight = parseReadsbResponse(capturedOverBenGurion).find(({ flight }) => flight === '4XHSC');
    expect(microlight).toMatchObject({ typeCode: 'EV97', altitudeFt: 275 });
    expect(microlight?.groundSpeedKt).toBeCloseTo(94.4);
  });
});

describe('position feeds', () => {
  const lol = adsbLol();
  const main = flyItalyAdsb('test-key');
  const sourceWith = (fetchFn: typeof fetch, feeds = [main, lol]) =>
    createPositionSource(feeds, { fetchFn, now: () => 0 });

  it('asks for the fixed tile around the user, never for the user spot itself', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ ac: [] }));
    await sourceWith(fetchFn, [lol]).refresh([BEN_GURION]);

    const url = String(fetchFn.mock.calls[0]?.[0]);
    expect(url).toBe('https://api.adsb.lol/v2/point/33/35/94');
    expect(url).not.toContain(String(BEN_GURION.lat));
  });

  it('sends the FlyItalyADSB key in a header and the radius in kilometres', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ ac: [] }));
    await sourceWith(fetchFn, [main]).refresh([BEN_GURION]);

    expect(String(fetchFn.mock.calls[0]?.[0])).toBe('https://api.flyitalyadsb.com/v2/lat/33/lon/35/dist/173');
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toEqual({ 'X-Api-Key': 'test-key' });
  });

  it('fetches a tile once for everyone in it, and measures each plane from each user', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(capturedOverBenGurion));
    const positions = sourceWith(fetchFn);
    const neighbour = { lat: 32.01, lon: 34.89 };
    await positions.refresh([BEN_GURION, neighbour]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    for (const point of [BEN_GURION, neighbour]) {
      const aircraft = positions.aircraftNear(point, 10);
      expect(aircraft.length).toBeGreaterThan(0);
      for (const plane of aircraft) {
        const raw = parseReadsbResponse(capturedOverBenGurion).find(({ id }) => id === plane.id);
        expect(plane.distanceNm).toBeCloseTo(bearingAndDistance(point, raw ?? point).distanceNm, 1);
      }
    }
  });

  it('leaves out planes beyond the user circle', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(capturedOverBenGurion));
    const positions = sourceWith(fetchFn);
    await positions.refresh([BEN_GURION]);
    expect(positions.aircraftNear(BEN_GURION, 3).every(({ distanceNm }) => distanceNm <= 3)).toBe(true);
  });

  it('spaces requests to the same feed as it asks', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => json({ ac: [] }));
    const refreshing = createPositionSource([lol], { fetchFn, now: Date.now }).refresh([
      BEN_GURION,
      { lat: 40.4, lon: -3.7 },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    await refreshing;
    vi.useRealTimers();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('uses only the main feed while it answers', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(capturedOverBenGurion));
    const positions = sourceWith(fetchFn);
    await positions.refresh([BEN_GURION]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('switches the whole tile to the backup when the main feed fails, never mixing the two', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json(capturedOverBenGurion));
    const positions = sourceWith(fetchFn);
    await positions.refresh([BEN_GURION]);

    expect(String(fetchFn.mock.calls[1]?.[0])).toContain('api.adsb.lol');
    expect(positions.aircraftNear(BEN_GURION, 10)).toHaveLength(2);
  });

  it('falls back when the main feed does not answer in time', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      .mockResolvedValueOnce(json({ ac: [] }));
    const positions = sourceWith(fetchFn);
    await positions.refresh([BEN_GURION]);
    expect(positions.aircraftNear(BEN_GURION, 3)).toEqual([]);
  });

  it('explains which feeds failed when none of them work', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 503))
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.adsb.lol'));
    const positions = sourceWith(fetchFn);
    await positions.refresh([BEN_GURION]);

    expect(() => positions.aircraftNear(BEN_GURION, 3)).toThrow(
      /FlyItalyADSB responded 503.*adsb\.lol failed: getaddrinfo ENOTFOUND/,
    );
  });

  it('stops fetching a tile once nobody is watched there', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ ac: [] }));
    const positions = sourceWith(fetchFn);
    await positions.refresh([BEN_GURION]);
    await positions.refresh([]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(() => positions.aircraftNear(BEN_GURION, 3)).toThrow(/No snapshot/);
  });
});

describe('tiles', () => {
  it('puts nearby phones in the same fixed tile and far ones in different tiles', () => {
    expect(tileAt(BEN_GURION).key).toBe(tileAt({ lat: 32.9, lon: 34.1 }).key);
    expect(tileAt(BEN_GURION).key).not.toBe(tileAt({ lat: 52.5, lon: 13.4 }).key);
  });

  it('reaches far enough past its corners to cover any search circle inside it', () => {
    const tile = tileAt(BEN_GURION);
    const corner = bearingAndDistance(tile.center, { lat: 32, lon: 34 });
    expect(tile.radiusNm).toBeGreaterThanOrEqual(corner.distanceNm + 10);
  });
});

describe('the sky above a user', () => {
  const aircraft = (flight: string, overrides: Partial<Aircraft & GeoPoint>): Aircraft & GeoPoint => ({
    id: flight.toLowerCase(),
    flight,
    ...BEN_GURION,
    altitudeFt: 3000,
    groundSpeedKt: 150,
    trackDeg: 300,
    distanceNm: 0.5,
    bearingDeg: 120,
    ...overrides,
  });

  const fixedFeed = (list: (Aircraft & GeoPoint)[]): PositionSource => ({
    refresh: async () => {},
    aircraftNear: () => list,
  });
  const knownRoutes = (): RouteSource & { asked: string[] } => {
    const asked: string[] = [];
    return {
      asked,
      routeFor(flight) {
        asked.push(flight);
        return { from: 'AUH', fromCity: 'Abu Dhabi', to: 'TLV', toCity: 'Tel Aviv' } satisfies Route;
      },
    };
  };

  const noRoutes: RouteSource = { routeFor: () => null };

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

    const planes = sky.planesAbove(BEN_GURION);

    expect(planes.map(({ flight, stage }) => `${flight}:${stage}`)).toEqual([
      'ELY001:overhead',
      'ETD597:overhead',
      'INBOUND1:approaching',
    ]);
  });

  it('looks routes up only for planes that go on a card, not ones merely on their way', async () => {
    const routes = knownRoutes();
    const sky = createSky(
      fixedFeed([
        aircraft('CRUISE1', { altitudeFt: 37000 }),
        aircraft('ELY001', { distanceNm: 0.4 }),
        aircraft('FAR1', { distanceNm: 6, bearingDeg: 90, trackDeg: 270, groundSpeedKt: 200 }),
      ]),
      routes,
    );

    const planes = sky.planesAbove(BEN_GURION);

    expect(planes.find(({ flight }) => flight === 'FAR1')).toMatchObject({ stage: 'inbound', route: null });
    expect(routes.asked).toEqual(['ELY001']);
  });

  it('names the airline and the aircraft', async () => {
    const sky = createSky(fixedFeed([aircraft('ISR053', { typeCode: 'A320' })]), knownRoutes());

    const [plane] = sky.planesAbove(BEN_GURION);

    expect(plane).toMatchObject({ airline: 'Israir', aircraft: 'A320', route: { to: 'TLV' } });
  });

  it('judges planes passing close exactly as without the hearing rule', async () => {
    const feed = fixedFeed([
      aircraft('ELY001', { distanceNm: 0.4 }),
      aircraft('INBOUND1', { distanceNm: 2.4, bearingDeg: 90, trackDeg: 270, groundSpeedKt: 240 }),
      aircraft('CRUISE1', { altitudeFt: 37000, distanceNm: 0.2 }),
    ]);
    const everythingLoud = { peakDb: () => 90 };

    const without = createSky(feed, noRoutes).planesAbove(BEN_GURION);
    const withHearing = createSky(feed, noRoutes, everythingLoud).planesAbove(BEN_GURION);

    expect(without.length).toBeGreaterThan(0);
    for (const plane of without) expect(withHearing).toContainEqual(plane);
  });

  it('adds planes passing too far for the close rule when they are loud enough to hear', async () => {
    const farPast = { distanceNm: 2.4, bearingDeg: 0, trackDeg: 270 };
    const noise = { peakDb: (plane: Aircraft) => (plane.flight === 'LOUD1' ? 52 : 40) };
    const sky = createSky(
      fixedFeed([aircraft('LOUD1', farPast), aircraft('QUIET1', farPast), aircraft('ELY001', {})]),
      noRoutes,
      noise,
    );

    const planes = sky.planesAbove(BEN_GURION);

    expect(planes.map(({ flight, stage, heardDb }) => ({ flight, stage, heardDb }))).toEqual([
      { flight: 'ELY001', stage: 'overhead', heardDb: undefined },
      { flight: 'LOUD1', stage: 'overhead', heardDb: 52 },
    ]);
  });

  it('keeps a plane whose route is unknown, with what we do know', async () => {
    const sky = createSky(fixedFeed([aircraft('4XCDO', { typeCode: 'C25A' })]), noRoutes);

    const [plane] = sky.planesAbove(BEN_GURION);

    expect(plane).toMatchObject({ flight: '4XCDO', aircraft: 'C25A', route: null, stage: 'overhead' });
    expect(plane?.airline).toBeUndefined();
  });
});
