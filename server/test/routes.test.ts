import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteSource } from '../src/flights/routes.js';

const fr24Response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('route source', () => {
  let now: number;
  let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    now = Date.UTC(2026, 10, 1, 12);
    fetchFn = vi.fn<typeof fetch>();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const source = () => createRouteSource({ fr24Token: 'token', fetchFn, now: () => now });

  it('looks a flight up once and serves the rest of the day from cache', async () => {
    fetchFn.mockResolvedValue(fr24Response({ data: [{ orig_iata: 'AUH', dest_iata: 'TLV' }] }));
    const routes = source();

    await routes.routeFor('ETD597');
    const route = await routes.routeFor('ETD597');

    expect(route).toMatchObject({ from: 'AUH', to: 'TLV', toCity: 'Tel Aviv' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failed lookup on every tick', async () => {
    fetchFn.mockResolvedValue(fr24Response({ message: 'Bad request' }, 400));
    const routes = source();

    await routes.routeFor('N');
    now += 5000;
    await routes.routeFor('N');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('tries a failed lookup again after a few minutes', async () => {
    fetchFn.mockResolvedValueOnce(fr24Response({}, 429));
    fetchFn.mockResolvedValueOnce(fr24Response({ data: [{ orig_iata: 'AUH', dest_iata: 'TLV' }] }));
    const routes = source();

    await routes.routeFor('ETD597');
    now += 10 * 60_000;
    const route = await routes.routeFor('ETD597');

    expect(route).toMatchObject({ from: 'AUH', to: 'TLV' });
  });

  it('asks Flightradar24 for this callsign over the last 20 hours', async () => {
    fetchFn.mockResolvedValue(fr24Response({ data: [] }));
    await source().routeFor('ETD75C');

    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(url.searchParams.get('callsigns')).toBe('ETD75C');
    expect(url.searchParams.get('flight_datetime_from')).toBe('2026-10-31 16:00:00');
    expect(url.searchParams.get('flight_datetime_to')).toBe('2026-11-01 12:00:00');
  });

  it('picks the leg flying now when a callsign flew there and back', async () => {
    fetchFn.mockResolvedValue(
      fr24Response({
        data: [
          { orig_iata: 'AUH', dest_iata: 'TLV', datetime_takeoff: '2026-10-31T19:40:00Z' },
          { orig_iata: 'TLV', dest_iata: 'AUH', datetime_takeoff: '2026-11-01T11:55:00Z' },
        ],
      }),
    );

    expect(await source().routeFor('ETD75C')).toMatchObject({ from: 'TLV', to: 'AUH' });
  });

  it('uses when the plane was first seen for a flight that has not logged its takeoff', async () => {
    fetchFn.mockResolvedValue(
      fr24Response({
        data: [
          { orig_iata: 'LTN', dest_iata: 'TLV', datetime_takeoff: '2026-10-31T17:00:00Z' },
          { orig_iata: 'TLV', dest_iata: 'LTN', datetime_takeoff: null, first_seen: '2026-11-01T11:50:00Z' },
        ],
      }),
    );

    expect(await source().routeFor('WUK619')).toMatchObject({ from: 'TLV', to: 'LTN' });
  });

  it('ignores legs without both airports and gives up when none are left', async () => {
    fetchFn.mockResolvedValue(fr24Response({ data: [{ orig_iata: 'TLV', dest_iata: null }] }));
    expect(await source().routeFor('4XHSC')).toBeNull();
  });

  it('remembers a flight without a route so it does not spend credits on it again', async () => {
    fetchFn.mockResolvedValue(fr24Response({ data: [] }));
    const routes = source();

    await routes.routeFor('4XHSC');
    now += 30 * 60_000;
    await routes.routeFor('4XHSC');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('shows the airport code when it does not know the city', async () => {
    fetchFn.mockResolvedValue(fr24Response({ data: [{ orig_iata: 'TLV', dest_iata: 'XQZ' }] }));
    expect(await source().routeFor('ELY999')).toMatchObject({ toCity: 'XQZ', fromCity: 'Tel Aviv' });
  });

  it('looks flights up again on a new day, when the same callsign can fly elsewhere', async () => {
    fetchFn
      .mockResolvedValueOnce(fr24Response({ data: [{ orig_iata: 'TLV', dest_iata: 'ATH' }] }))
      .mockResolvedValueOnce(fr24Response({ data: [{ orig_iata: 'TLV', dest_iata: 'LCA' }] }));
    const routes = source();

    await routes.routeFor('ISR701');
    now = Date.UTC(2026, 10, 2, 0, 5);
    const nextDay = await routes.routeFor('ISR701');

    expect(nextDay).toMatchObject({ to: 'LCA' });
  });
});
