import { gunzipSync } from 'node:zlib';
import type { Route } from '@overhead/shared';
import airportsByIcao from './airports.json' with { type: 'json' };

export interface RouteSource {
  routeFor(flight: string): Route | null;
}

export interface RouteDirectory extends RouteSource {
  load(): Promise<void>;
  // Distinct flights asked for since the last call, and how many had a route.
  takeCoverage(): { asked: number; found: number };
}

// Virtual Radar Server standing data (CC0), the daily single-file copy of its routes.
const STANDING_DATA_URL = 'https://vrs-standing-data.adsb.lol/routes.csv.gz';
const DOWNLOAD_TIMEOUT_MS = 60_000;

const airports: Record<string, string[]> = airportsByIcao;

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
    routeFor(flight) {
      const stops = routes.get(flight)?.split('-');
      // A flight with stopovers could be on any leg, so it shows no route rather than a wrong one.
      const route = stops?.length === 2 ? routeBetween(stops[0]!, stops[1]!) : null;
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

export function routeBetween(fromIcao: string, toIcao: string): Route {
  const [from = fromIcao, fromCity = fromIcao] = airports[fromIcao] ?? [];
  const [to = toIcao, toCity = toIcao] = airports[toIcao] ?? [];
  return { from, fromCity, to, toCity };
}
