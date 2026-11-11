import { gunzipSync } from 'node:zlib';
import type { Route } from '@overhead/shared';
import airportsByIcao from './airports.json' with { type: 'json' };

export interface RouteSource {
  routeFor(flight: string): Route | null;
}

export interface RouteDirectory extends RouteSource {
  load(): Promise<void>;
}

// Virtual Radar Server standing data (CC0), the daily single-file copy of its routes.
const STANDING_DATA_URL = 'https://vrs-standing-data.adsb.lol/routes.csv.gz';
const DOWNLOAD_TIMEOUT_MS = 60_000;

const airports: Record<string, string[]> = airportsByIcao;

// Routes by callsign, held in memory and replaced in one step when a new copy loads.
// A failed download keeps the routes already loaded.
export function createRouteDirectory(fetchFn: typeof fetch = fetch): RouteDirectory {
  let routes = new Map<string, string>();

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
      return stops?.length === 2 ? routeBetween(stops[0]!, stops[1]!) : null;
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
