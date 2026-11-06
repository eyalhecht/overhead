import type { Route } from '@overhead/shared';
import { z } from 'zod';
import airportCities from './airports.json' with { type: 'json' };

export interface RouteSource {
  routeFor(flight: string): Promise<Route | null>;
}

type RouteProvider = (flight: string) => Promise<Route | null>;

interface RouteSourceOptions {
  fr24Token?: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

const REQUEST_TIMEOUT_MS = 6000;
const FAILED_LOOKUP_RETRY_MS = 5 * 60_000;
const FR24_LOOKBACK_MS = 20 * 60 * 60 * 1000;
const FR24_SUMMARY_URL = 'https://fr24api.flightradar24.com/api/flight-summary/full';
const ADSBDB_CALLSIGN_URL = 'https://api.adsbdb.com/v0/callsign';

const cities: Record<string, string> = airportCities;

export function createRouteSource({
  fr24Token,
  fetchFn = fetch,
  now = Date.now,
}: RouteSourceOptions): RouteSource {
  const provider = fr24Token ? flightradar24(fr24Token, fetchFn, now) : adsbdb(fetchFn);
  const cache = new Map<string, Promise<Route | null>>();
  const failedAt = new Map<string, number>();
  let cacheDay = '';

  async function lookUp(flight: string): Promise<Route | null> {
    try {
      return await provider(flight);
    } catch (error) {
      cache.delete(flight);
      failedAt.set(flight, now());
      console.warn(`Route lookup failed for ${flight}: ${(error as Error).message}`);
      return null;
    }
  }

  return {
    routeFor(flight) {
      const today = new Date(now()).toISOString().slice(0, 10);
      if (today !== cacheDay) {
        cache.clear();
        failedAt.clear();
        cacheDay = today;
      }
      const cached = cache.get(flight);
      if (cached) return cached;
      if (now() - (failedAt.get(flight) ?? -Infinity) < FAILED_LOOKUP_RETRY_MS) return Promise.resolve(null);

      const route = lookUp(flight);
      cache.set(flight, route);
      return route;
    },
  };
}

export function routeBetween(from: string, to: string): Route {
  return { from, fromCity: cities[from] ?? from, to, toCity: cities[to] ?? to };
}

const Fr24SummarySchema = z.object({
  data: z
    .array(
      z.object({
        orig_iata: z.string().nullish(),
        dest_iata: z.string().nullish(),
        datetime_takeoff: z.string().nullish(),
        first_seen: z.string().nullish(),
      }),
    )
    .default([]),
});

function flightradar24(token: string, fetchFn: typeof fetch, now: () => number): RouteProvider {
  return async (flight) => {
    const params = new URLSearchParams({
      callsigns: flight,
      flight_datetime_from: fr24Time(now() - FR24_LOOKBACK_MS),
      flight_datetime_to: fr24Time(now()),
    });
    const response = await fetchFn(`${FR24_SUMMARY_URL}?${params}`, {
      headers: { Accept: 'application/json', 'Accept-Version': 'v1', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Flightradar24 responded ${response.status}`);

    const { data } = Fr24SummarySchema.parse(await response.json());
    const latest = data
      .flatMap(({ orig_iata, dest_iata, datetime_takeoff, first_seen }) =>
        orig_iata && dest_iata
          ? [{ orig_iata, dest_iata, departedAt: datetime_takeoff ?? first_seen ?? '' }]
          : [],
      )
      .sort((a, b) => b.departedAt.localeCompare(a.departedAt))[0];

    return latest ? routeBetween(latest.orig_iata, latest.dest_iata) : null;
  };
}

function fr24Time(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 19).replace('T', ' ');
}

const AdsbdbResponseSchema = z.object({
  response: z.union([
    z.string(),
    z.object({
      flightroute: z.object({
        origin: z.object({ iata_code: z.string() }),
        destination: z.object({ iata_code: z.string() }),
      }),
    }),
  ]),
});

function adsbdb(fetchFn: typeof fetch): RouteProvider {
  return async (flight) => {
    const response = await fetchFn(`${ADSBDB_CALLSIGN_URL}/${encodeURIComponent(flight)}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`adsbdb responded ${response.status}`);

    const { response: body } = AdsbdbResponseSchema.parse(await response.json());
    if (typeof body === 'string') return null;
    return routeBetween(body.flightroute.origin.iata_code, body.flightroute.destination.iata_code);
  };
}
