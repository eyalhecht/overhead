import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPlanesAbove, register } from './api';

const EXACT = { lat: 32.069_384_7, lon: 34.773_812_9 };
const ROUGH = { lat: 32.069, lon: 34.774 };

const sent = () => {
  const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('[]'));
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
};

afterEach(() => vi.unstubAllGlobals());

describe('what leaves the phone', () => {
  it('asks for nearby planes with a location rounded to about 100 m', async () => {
    const fetchFn = sent();
    await fetchPlanesAbove(EXACT);

    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(url.searchParams.get('lat')).toBe(String(ROUGH.lat));
    expect(url.searchParams.get('lon')).toBe(String(ROUGH.lon));
  });

  it('checks in with a location rounded to about 100 m', async () => {
    const fetchFn = sent();
    await register({
      deviceId: 'phone-1',
      ...EXACT,
      activityTokens: [],
      quietHours: null,
      utcOffsetMinutes: 120,
    });

    const body = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject(ROUGH);
  });
});
