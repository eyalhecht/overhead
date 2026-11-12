import { gunzipSync } from 'node:zlib';
import type { GeoPoint, Route } from '@overhead/shared';
import airportPositions from './airport-positions.json' with { type: 'json' };
import airportsByIcao from './airports.json' with { type: 'json' };
import { distanceAndBearing, type Aircraft } from './geometry.js';

export type PlaneFix = GeoPoint & Pick<Aircraft, 'verticalRateFpm'>;

export interface RouteSource {
  routeFor(flight: string, plane?: PlaneFix): Route | null;
}

export interface RouteDirectory extends RouteSource {
  load(): Promise<void>;
  // Distinct flights asked for since the last call, and how many had a route.
  takeCoverage(): { asked: number; found: number };
}

// Virtual Radar Server standing data (CC0), the daily single-file copy of its routes.
const STANDING_DATA_URL = 'https://vrs-standing-data.adsb.lol/routes.csv.gz';
const DOWNLOAD_TIMEOUT_MS = 60_000;

const STOP_RADIUS_NM = 30;
const CLEAR_CLIMB_FPM = 300;

const airports: Record<string, string[]> = airportsByIcao;
const positions: Record<string, number[]> = airportPositions;

// Routes by callsign, held in memory and replaced in one step when a new copy loads.
// A failed download keeps the routes already loaded.
export function createRouteDirectory(fetchFn: typeof fetch = fetch): RouteDirectory {
  let routes = new Map<string, string>();
  let asked = new Set<string>();
  let found = new Set<string>();

  return {
    async load() {
      try {
        const response = await fetchFn(STANDING_DATA_URL, {
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`responded ${response.status}`);
        routes = parseStandingData(gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8'));
        console.log(`Route directory: ${routes.size} routes loaded`);
      } catch (error) {
        console.warn(`Route directory not updated: ${(error as Error).message}`);
      }
    },
    routeFor(flight, plane) {
      // The standing data writes flight numbers without the leading zeros some airlines broadcast (EVA006 is EVA6).
      const stops = routes.get(flight.replace(/^([A-Z]{3})0+(?=\d)/, '$1'))?.split('-');
      const leg = stops && legFor(stops, plane);
      const route = leg ? routeBetween(...leg) : null;
      asked.add(flight);
      if (route) found.add(flight);
      return route;
    },
    takeCoverage() {
      const coverage = { asked: asked.size, found: found.size };
      asked = new Set();
      found = new Set();
      return coverage;
    },
  };
}

export function parseStandingData(csv: string): Map<string, string> {
  const routes = new Map<string, string>();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [callsign, , , , airportCodes] = line.split(',');
    if (callsign && airportCodes) routes.set(callsign, airportCodes);
  }
  return routes;
}

// A flight with stopovers shows only the leg it is clearly flying: climbing away from a stop or descending into one.
// Anything less clear shows no route rather than a wrong one.
export function legFor(stops: string[], plane?: PlaneFix): [string, string] | null {
  if (stops.length === 2) return [stops[0]!, stops[1]!];
  const rate = plane?.verticalRateFpm;
  if (!plane || rate === undefined || Math.abs(rate) < CLEAR_CLIMB_FPM) return null;
  const climbing = rate > 0;
  const candidates = stops
    .map((icao, index) => ({ icao, index }))
    .filter(({ index }) => (climbing ? index < stops.length - 1 : index > 0))
    .filter(({ icao }) => {
      const [lat, lon] = positions[icao] ?? [];
      return (
        lat !== undefined &&
        lon !== undefined &&
        distanceAndBearing(plane, { lat, lon }).distanceNm <= STOP_RADIUS_NM
      );
    });
  if (new Set(candidates.map(({ icao }) => icao)).size !== 1) return null;
  const { index } = candidates[0]!;
  return climbing ? [stops[index]!, stops[index + 1]!] : [stops[index - 1]!, stops[index]!];
}

export function routeBetween(fromIcao: string, toIcao: string): Route {
  const [from = fromIcao, fromCity = fromIcao] = airports[fromIcao] ?? [];
  const [to = toIcao, toCity = toIcao] = airports[toIcao] ?? [];
  return { from, fromCity, to, toCity };
}
