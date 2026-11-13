import type { GeoPoint } from '@overhead/shared';
import { z } from 'zod';
import { distanceAndBearing, type Aircraft } from './geometry.js';

export interface Feed {
  name: string;
  requestGapMs: number;
  request(tile: Tile): { url: string; headers?: Record<string, string> };
}

export interface Tile {
  key: string;
  center: GeoPoint;
  radiusNm: number;
}

export interface PositionSource {
  refresh(points: GeoPoint[]): Promise<void>;
  aircraftNear(point: GeoPoint, radiusNm: number): (Aircraft & GeoPoint)[];
}

type LocatedAircraft = Omit<Aircraft, 'distanceNm' | 'bearingDeg'> & GeoPoint;

type Snapshot = { aircraft: LocatedAircraft[] } | { failure: string };

interface PositionSourceOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
}

const TILE_DEGREES = 2;
const TILE_MARGIN_NM = 15;
const NM_PER_DEGREE = 60;
const KM_PER_NM = 1.852;
const FEED_TIMEOUT_MS = 4000;
const MAX_POSITION_AGE_S = 60;
const SECONDS_PER_HOUR = 3600;

export function adsbLol(): Feed {
  return {
    name: 'adsb.lol',
    requestGapMs: 1000,
    request: ({ center, radiusNm }) => ({
      url: `https://api.adsb.lol/v2/point/${center.lat}/${center.lon}/${Math.ceil(radiusNm)}`,
    }),
  };
}

export function flyItalyAdsb(apiKey: string): Feed {
  return {
    name: 'FlyItalyADSB',
    requestGapMs: 200,
    request: ({ center, radiusNm }) => ({
      url: `https://api.flyitalyadsb.com/v2/lat/${center.lat}/lon/${center.lon}/dist/${Math.ceil(radiusNm * KM_PER_NM)}`,
      headers: { 'X-Api-Key': apiKey },
    }),
  };
}

// Fixed tiles, so a feed only ever sees a grid square, never anything built around a phone.
// Each tile's query reaches past its edges far enough to cover every phone's search circle inside it.
export function tileAt({ lat, lon }: GeoPoint): Tile {
  const row = Math.floor(lat / TILE_DEGREES);
  const column = Math.floor(lon / TILE_DEGREES);
  const center = { lat: (row + 0.5) * TILE_DEGREES, lon: (column + 0.5) * TILE_DEGREES };
  const halfHeightNm = (TILE_DEGREES / 2) * NM_PER_DEGREE;
  const halfWidthNm = halfHeightNm * Math.cos((center.lat * Math.PI) / 180);
  return {
    key: `${row}:${column}`,
    center,
    radiusNm: Math.hypot(halfHeightNm, halfWidthNm) + TILE_MARGIN_NM,
  };
}

// The latest snapshot per tile where at least one phone is watched, from the first feed that answers.
// Feeds are never merged: their licences (CC BY-SA and ODbL) are incompatible.
export function createPositionSource(
  feeds: Feed[],
  { fetchFn = fetch, now = Date.now }: PositionSourceOptions = {},
): PositionSource {
  const snapshots = new Map<string, Snapshot>();
  const nextRequestAt = new Map<string, number>();

  async function waitForTurn(feed: Feed): Promise<void> {
    const waitMs = Math.max(0, (nextRequestAt.get(feed.name) ?? 0) - now());
    nextRequestAt.set(feed.name, now() + waitMs + feed.requestGapMs);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async function fetchTile(tile: Tile): Promise<Snapshot> {
    const failures: string[] = [];
    for (const feed of feeds) {
      try {
        await waitForTurn(feed);
        const { url, headers } = feed.request(tile);
        const response = await fetchFn(url, { headers, signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
        if (response.ok) return { aircraft: parseReadsbResponse(await response.json()) };
        failures.push(`${feed.name} responded ${response.status}`);
      } catch (error) {
        failures.push(`${feed.name} failed: ${(error as Error).message}`);
      }
    }
    return { failure: `All position feeds failed (${failures.join('; ')})` };
  }

  function snapshotAt(point: GeoPoint): Snapshot {
    return snapshots.get(tileAt(point).key) ?? { failure: 'No snapshot of this area yet' };
  }

  return {
    async refresh(points) {
      const tiles = new Map(points.map((point) => [tileAt(point).key, tileAt(point)]));
      for (const key of snapshots.keys()) if (!tiles.has(key)) snapshots.delete(key);
      await Promise.all(
        [...tiles.values()].map(async (tile) => snapshots.set(tile.key, await fetchTile(tile))),
      );
    },
    aircraftNear(point, radiusNm) {
      const snapshot = snapshotAt(point);
      if ('failure' in snapshot) throw new Error(snapshot.failure);
      return snapshot.aircraft
        .map((plane) => ({ ...plane, ...distanceAndBearing(point, plane) }))
        .filter((plane) => plane.distanceNm <= radiusNm);
    },
  };
}

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
  seen: z.number().optional(),
  seen_pos: z.number().optional(),
});

const ReadsbResponseSchema = z.object({ ac: z.array(z.unknown()).default([]) });

// Where a plane is now, given an older position: receivers near the ground can lag by most of a minute.
function movedAlongTrack({ lat, lon }: GeoPoint, trackDeg: number, distanceNm: number): GeoPoint {
  const radians = (trackDeg * Math.PI) / 180;
  const latitude = lat + (distanceNm * Math.cos(radians)) / NM_PER_DEGREE;
  const longitude =
    lon + (distanceNm * Math.sin(radians)) / (NM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  return { lat: latitude, lon: longitude };
}

export function parseReadsbResponse(body: unknown): LocatedAircraft[] {
  return ReadsbResponseSchema.parse(body).ac.flatMap((entry) => {
    const parsed = ReadsbAircraftSchema.safeParse(entry);
    if (!parsed.success) return [];
    const { hex, flight, t, alt_baro, baro_rate, gs, track, lat, lon, seen, seen_pos } = parsed.data;
    const ageS = seen_pos ?? seen ?? 0;
    // Some feeds report a plane on the ground as altitude 0 with its last flying speed.
    if (alt_baro === 0 || ageS > MAX_POSITION_AGE_S) return [];
    return [
      {
        id: hex,
        ...movedAlongTrack({ lat, lon }, track, (gs * ageS) / SECONDS_PER_HOUR),
        flight,
        typeCode: t,
        altitudeFt: alt_baro,
        verticalRateFpm: baro_rate,
        groundSpeedKt: gs,
        trackDeg: track,
      },
    ];
  });
}
