import { z } from 'zod';
import type { Aircraft } from './geometry.js';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface PositionSource {
  aircraftNear(point: GeoPoint, radiusNm: number): Promise<Aircraft[]>;
}

const FEED_TIMEOUT_MS = 4000;

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
  gs: z.number().default(0),
  track: z.number().default(0),
  dst: z.number(),
  dir: z.number(),
});

const ReadsbResponseSchema = z.object({ ac: z.array(z.unknown()).default([]) });

export function createPositionSource(fetchFn: typeof fetch = fetch): PositionSource {
  return {
    async aircraftNear(point, radiusNm) {
      const failures: string[] = [];
      for (const feed of FEEDS) {
        try {
          const response = await fetchFn(feed.url(point, radiusNm), {
            signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
          });
          if (response.ok) return parseReadsbResponse(await response.json());
          failures.push(`${feed.name} responded ${response.status}`);
        } catch (error) {
          failures.push(`${feed.name} failed: ${(error as Error).message}`);
        }
      }
      throw new Error(`All position feeds failed (${failures.join('; ')})`);
    },
  };
}

export function parseReadsbResponse(body: unknown): Aircraft[] {
  return ReadsbResponseSchema.parse(body).ac.flatMap((entry) => {
    const parsed = ReadsbAircraftSchema.safeParse(entry);
    if (!parsed.success) return [];
    const { hex, flight, t, alt_baro, gs, track, dst, dir } = parsed.data;
    return [
      {
        id: hex,
        flight,
        typeCode: t,
        altitudeFt: alt_baro,
        groundSpeedKt: gs,
        trackDeg: track,
        distanceNm: dst,
        bearingDeg: dir,
      },
    ];
  });
}
