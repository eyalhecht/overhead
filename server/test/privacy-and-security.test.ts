import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWatcher, type Watcher } from '../src/activity/watcher.js';
import { createApp } from '../src/api/app.js';
import { createPositionSource } from '../src/flights/positions.js';
import { createRouteSource } from '../src/flights/routes.js';
import { createSky } from '../src/flights/sky.js';
import { createUserStore } from '../src/users.js';
import { FakePush, registerRequest } from './fakes.js';

const APP_KEY = 'test-key';
const PHONE = {
  deviceId: '8F14E45F-CEEA-467A-9575-0A5C5E1B4D3A',
  lat: 32.069,
  lon: 34.774,
  startToken: 'a1'.repeat(40),
};
const CARD_TOKEN = 'b2'.repeat(40);
const SECRETS = [String(PHONE.lat), String(PHONE.lon), PHONE.deviceId, PHONE.startToken, CARD_TOKEN];

const PLANE_OVERHEAD = {
  hex: '738065',
  flight: 'ELY001  ',
  t: 'B738',
  alt_baro: 3000,
  gs: 200,
  track: 270,
  dst: 0.3,
  dir: 90,
};

interface SentRequest {
  url: string;
  headers: string;
}

describe('privacy and security', () => {
  let sent: SentRequest[];
  let feedDown: boolean;
  let routesDown: boolean;
  let logged: string[];
  let push: FakePush;
  let watcher: Watcher;
  let app: ReturnType<typeof createApp>;

  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    sent.push({ url, headers: JSON.stringify(init?.headers ?? {}) });
    if (url.includes('fr24api')) {
      if (routesDown) return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ data: [{ orig_iata: 'LCA', dest_iata: 'TLV' }] }));
    }
    if (feedDown) throw new Error('connect ECONNREFUSED');
    return new Response(JSON.stringify({ ac: [PLANE_OVERHEAD] }));
  };

  beforeEach(() => {
    sent = [];
    feedDown = false;
    routesDown = false;
    logged = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(
          args.map((arg) => (arg instanceof Error ? `${arg.message} ${arg.stack}` : String(arg))).join(' '),
        );
      });
    }
    const users = createUserStore();
    const sky = createSky(createPositionSource(fetchFn), createRouteSource({ fr24Token: 'fr24', fetchFn }));
    push = new FakePush();
    watcher = createWatcher({ users, sky, push });
    app = createApp({ appKey: APP_KEY, users, watcher });
  });

  afterEach(() => vi.restoreAllMocks());

  const checkIn = (cardTokens: string[] = []) =>
    request(app)
      .post('/register')
      .set('x-app-key', APP_KEY)
      .send(registerRequest({ ...PHONE, activityTokens: cardTokens }))
      .expect(204);

  async function aWholeDay(): Promise<void> {
    await checkIn();
    await watcher.tick();
    await checkIn([CARD_TOKEN]);
    await watcher.tick();
    await request(app).get(`/sky?deviceId=${PHONE.deviceId}`).set('x-app-key', APP_KEY).expect(200);
    feedDown = true;
    await watcher.tick();
    feedDown = false;
    routesDown = true;
    push.result = 'failed';
    await watcher.tick();
    push.result = 'token-invalid';
    await watcher.tick();
  }

  it('never writes a location, a full device ID or a push token to the logs', async () => {
    await aWholeDay();

    expect(logged.length).toBeGreaterThan(0);
    for (const secret of SECRETS) {
      expect(logged.join('\n')).not.toContain(secret);
    }
  });

  it('gives the flight-position feeds only the rough location, never who is asking', async () => {
    await aWholeDay();

    const feeds = sent.filter(({ url }) => url.includes('adsb'));
    expect(feeds.length).toBeGreaterThan(0);
    for (const { url, headers } of feeds) {
      expect(url).toMatch(new RegExp(`/${PHONE.lat}/(lon/)?${PHONE.lon}/`));
      for (const secret of [PHONE.deviceId, PHONE.startToken, CARD_TOKEN]) {
        expect(url + headers).not.toContain(secret);
      }
    }
  });

  it('gives Flightradar24 only flight numbers, never a location or who is asking', async () => {
    await aWholeDay();

    const lookups = sent.filter(({ url }) => url.includes('fr24api'));
    expect(lookups.length).toBeGreaterThan(0);
    for (const { url, headers } of lookups) {
      expect(new URL(url).searchParams.get('callsigns')).toBe('ELY001');
      for (const secret of SECRETS) {
        expect(url + headers).not.toContain(secret);
      }
    }
  });

  it('talks to no service besides the two flight feeds and Flightradar24', async () => {
    await aWholeDay();

    const hosts = new Set(sent.map(({ url }) => new URL(url).host));
    expect([...hosts].sort()).toEqual(['api.adsb.lol', 'fr24api.flightradar24.com', 'opendata.adsb.fi']);
  });

  it('answers an unexpected failure without any internal detail', async () => {
    const broken = {
      ...watcher,
      reportCardTokens: () => Promise.reject(new Error('disk full at /opt/overhead/data')),
    };
    const response = await request(createApp({ appKey: APP_KEY, users: createUserStore(), watcher: broken }))
      .post('/register')
      .set('x-app-key', APP_KEY)
      .send(registerRequest(PHONE))
      .expect(500);

    expect(response.body).toEqual({ error: 'Internal error' });
  });

  it('never echoes a rejected token back to the caller', async () => {
    const smuggled = '../../3/device/someone-else';
    const response = await request(app)
      .post('/register')
      .set('x-app-key', APP_KEY)
      .send(registerRequest({ ...PHONE, startToken: smuggled }))
      .expect(400);

    expect(JSON.stringify(response.body)).not.toContain(smuggled);
  });

  it('refuses every request that lacks the app key', async () => {
    await request(app).post('/register').send(registerRequest(PHONE)).expect(401);
    await request(app).get(`/sky?deviceId=${PHONE.deviceId}`).expect(401);
  });
});
