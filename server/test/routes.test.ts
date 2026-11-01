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
});
