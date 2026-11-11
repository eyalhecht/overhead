import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSky, forgetPhone, register } from './api';

const EXACT = { lat: 32.069_384_7, lon: 34.773_812_9 };
const ROUGH = { lat: 32.069, lon: 34.774 };

const sent = () => {
  const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
};

afterEach(() => vi.unstubAllGlobals());

describe('what leaves the phone', () => {
  it('asks for the sky by device id only, with no location', async () => {
    const fetchFn = sent();
    await fetchSky('phone-1');

    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/sky');
    expect([...url.searchParams.keys()]).toEqual(['deviceId']);
  });

  it('asks the server to forget the phone by its device id only', async () => {
    const fetchFn = sent();
    await forgetPhone('phone-1');

    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(fetchFn.mock.calls[0]?.[1]?.method).toBe('DELETE');
    expect(url.pathname).toBe('/me');
    expect([...url.searchParams]).toEqual([['deviceId', 'phone-1']]);
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
