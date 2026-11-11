import { gzipSync } from 'node:zlib';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWatcher, type Watcher } from '../src/activity/watcher.js';
import { createApp } from '../src/api/app.js';
import { adsbLol, createPositionSource } from '../src/flights/positions.js';
import { createRouteDirectory } from '../src/flights/routes.js';
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
  lat: 32.069,
  lon: 34.7799,
};
const FIXED_TILE = 'https://api.adsb.lol/v2/point/33/35/94';
const ROUTE_LIST = 'https://vrs-standing-data.adsb.lol/routes.csv.gz';

interface SentRequest {
  url: string;
  headers: string;
}

describe('privacy and security', () => {
  let sent: SentRequest[];
  let feedDown: boolean;
  let logged: string[];
  let push: FakePush;
  let watcher: Watcher;
  let app: ReturnType<typeof createApp>;
  let clock: number;

  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    sent.push({ url, headers: JSON.stringify(init?.headers ?? {}) });
    if (url === ROUTE_LIST)
      return new Response(
        gzipSync('Callsign,Code,Number,AirlineCode,AirportCodes\nELY001,ELY,1,ELY,LCLK-LLBG'),
      );
    if (feedDown) throw new Error('connect ECONNREFUSED');
    return new Response(JSON.stringify({ ac: [PLANE_OVERHEAD] }));
  };

  beforeEach(async () => {
    sent = [];
    feedDown = false;
    logged = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(
          args.map((arg) => (arg instanceof Error ? `${arg.message} ${arg.stack}` : String(arg))).join(' '),
        );
      });
    }
    const users = createUserStore();
    clock = Date.now();
    const positions = createPositionSource([adsbLol()], { fetchFn, now: () => clock });
    const routes = createRouteDirectory(fetchFn);
    await routes.load();
    const sky = createSky(positions, routes);
    push = new FakePush();
    watcher = createWatcher({ users, sky, push, now: () => clock });
    app = createApp({ appKey: APP_KEY, users, watcher });
  });

  afterEach(() => vi.restoreAllMocks());

  const nextTick = () => {
    clock += 5000;
    return watcher.tick();
  };

  const checkIn = (cardTokens: string[] = []) =>
    request(app)
      .post('/register')
      .set('x-app-key', APP_KEY)
      .send(registerRequest({ ...PHONE, activityTokens: cardTokens }))
      .expect(204);

  async function aWholeDay(): Promise<void> {
    await checkIn();
    await nextTick();
    await checkIn([CARD_TOKEN]);
    await nextTick();
    await request(app).get(`/sky?deviceId=${PHONE.deviceId}`).set('x-app-key', APP_KEY).expect(200);
    feedDown = true;
    await nextTick();
    feedDown = false;
    push.result = 'failed';
    await nextTick();
    push.result = 'token-invalid';
    await nextTick();
  }

  it('never writes a location, a full device ID or a push token to the logs', async () => {
    await aWholeDay();

    expect(logged.length).toBeGreaterThan(0);
    for (const secret of SECRETS) {
      expect(logged.join('\n')).not.toContain(secret);
    }
  });

  it('gives the flight-position feed only a fixed map tile, never the phone location or who is asking', async () => {
    await aWholeDay();

    const feeds = sent.filter(({ url }) => url.includes('/v2/point/'));
    expect(feeds.length).toBeGreaterThan(0);
    for (const { url, headers } of feeds) {
      expect(url).toBe(FIXED_TILE);
      for (const secret of SECRETS) {
        expect(url + headers).not.toContain(secret);
      }
    }
  });

  it('asks the feed for the same tile however precise the phone location is', async () => {
    await request(app)
      .post('/register')
      .set('x-app-key', APP_KEY)
      .send(registerRequest({ ...PHONE, lat: 32.0694321, lon: 34.7741234 }))
      .expect(204);
    await nextTick();

    const feeds = sent.filter(({ url }) => url.includes('/v2/point/'));
    expect(feeds.map(({ url }) => url)).toEqual([FIXED_TILE]);
  });

  it('downloads the route list without anything about the phone, and looks routes up locally', async () => {
    await aWholeDay();

    const downloads = sent.filter(({ url }) => url === ROUTE_LIST);
    expect(downloads).toHaveLength(1);
    for (const { headers } of downloads) {
      for (const secret of SECRETS) expect(headers).not.toContain(secret);
    }
  });

  it('talks to no service besides the flight feed and the route list', async () => {
    await aWholeDay();

    const hosts = new Set(sent.map(({ url }) => new URL(url).host));
    expect([...hosts].sort()).toEqual(['api.adsb.lol', 'vrs-standing-data.adsb.lol']);
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
