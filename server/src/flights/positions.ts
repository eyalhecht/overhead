import type { GeoPoint } from '@overhead/shared';
import { z } from 'zod';
import { distanceAndBearing, type Aircraft } from './geometry.js';

export interface PositionSource {
  aircraftNear(point: GeoPoint, radiusNm: number): Promise<Aircraft[]>;
}

const FEED_TIMEOUT_MS = 4000;
const MIN_REQUEST_GAP_MS = 1000;
const AREA_DEGREES = 0.1;
const AREA_MARGIN_NM = 4.5;
const SHARE_AREA_FOR_MS = 4000;

type LocatedAircraft = Aircraft & GeoPoint;

interface Area {
  fetchedAt: number;
  aircraft: Promise<LocatedAircraft[]>;
}

interface PositionSourceOptions {
  now?: () => number;
  minRequestGapMs?: number;
}

const FEEDS = [
  {
    name: 'adsb.fi',
    url: (point: GeoPoint, radiusNm: number) =>
      `https://opendata.adsb.fi/api/v3/lat/${point.lat}/lon/${point.lon}/dist/${radiusNm}`,
  },
  {
    name: 'adsb.lol',
    url: (point: GeoPoint, radiusNm: number) =>
      `https://api.adsb.lol/v2/point/${point.lat}/${point.lon}/${radiusNm}`,
  },
];

const ReadsbAircraftSchema = z.object({
  hex: z.string(),
  flight: z.string().trim().min(1),
  t: z.string().optional(),
  alt_baro: z.number(),
  baro_rate: z.number().optional(),
  gs: z.number().default(0),
  track: z.number().default(0),
  lat: z.number(),
  lon: z.number(),
  dst: z.number(),
  dir: z.number(),
});

const ReadsbResponseSchema = z.object({ ac: z.array(z.unknown()).default([]) });

export function createPositionSource(
  fetchFn: typeof fetch = fetch,
  { now = Date.now, minRequestGapMs = MIN_REQUEST_GAP_MS }: PositionSourceOptions = {},
): PositionSource {
  const areas = new Map<string, Area>();
  const nextRequestAt = new Map<string, number>();

  async function waitForTurn(feedName: string): Promise<void> {
    const waitMs = Math.max(0, (nextRequestAt.get(feedName) ?? 0) - now());
    nextRequestAt.set(feedName, now() + waitMs + minRequestGapMs);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async function fetchArea(center: GeoPoint, radiusNm: number): Promise<LocatedAircraft[]> {
    const failures: string[] = [];
    for (const feed of FEEDS) {
      try {
        await waitForTurn(feed.name);
        const response = await fetchFn(feed.url(center, radiusNm), {
          signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
        });
        if (response.ok) return parseReadsbResponse(await response.json());
        failures.push(`${feed.name} responded ${response.status}`);
      } catch (error) {
        failures.push(`${feed.name} failed: ${(error as Error).message}`);
      }
    }
    throw new Error(`All position feeds failed (${failures.join('; ')})`);
  }

  function sharedArea(point: GeoPoint, radiusNm: number): Area {
    const center = areaCenter(point);
    const key = `${center.lat},${center.lon},${radiusNm}`;
    for (const [oldKey, area] of areas) {
      if (now() - area.fetchedAt > SHARE_AREA_FOR_MS) areas.delete(oldKey);
    }
    const area = areas.get(key) ?? {
      fetchedAt: now(),
      aircraft: fetchArea(center, radiusNm + AREA_MARGIN_NM),
    };
    areas.set(key, area);
    return area;
  }

  return {
    async aircraftNear(point, radiusNm) {
      const aircraft = await sharedArea(point, radiusNm).aircraft;
      return aircraft
        .map((plane) => ({ ...plane, ...distanceAndBearing(point, plane) }))
        .filter((plane) => plane.distanceNm <= radiusNm);
    },
  };
}

function areaCenter({ lat, lon }: GeoPoint): GeoPoint {
  const center = (degrees: number) =>
    Number(((Math.floor(degrees / AREA_DEGREES) + 0.5) * AREA_DEGREES).toFixed(2));
  return { lat: center(lat), lon: center(lon) };
}

export function parseReadsbResponse(body: unknown): LocatedAircraft[] {
  return ReadsbResponseSchema.parse(body).ac.flatMap((entry) => {
    const parsed = ReadsbAircraftSchema.safeParse(entry);
    if (!parsed.success) return [];
    const { hex, flight, t, alt_baro, baro_rate, gs, track, lat, lon, dst, dir } = parsed.data;
    return [
      {
        id: hex,
        lat,
        lon,
        flight,
        typeCode: t,
        altitudeFt: alt_baro,
        verticalRateFpm: baro_rate,
        groundSpeedKt: gs,
        trackDeg: track,
        distanceNm: dst,
        bearingDeg: dir,
      },
    ];
  });
}
