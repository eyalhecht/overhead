// Scale simulator: real server code (watcher, policy, SQLite store, HTTP API) driven by simulated phones
// on replayed real traffic. Nothing leaves the machine: flights come from a recording, Apple push is counted.
// Run: npm run simulate -w server -- --users 100 --traffic <sim-traffic.jsonl.gz> [--anp <dir>]
// The traffic file comes from extract-traffic.py and an adsb.lol globe_history archive.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { QUIET_HOURS, type ActivityProps, type GeoPoint } from '@overhead/shared';
import { createWatcher } from '../src/activity/watcher.js';
import type { LiveActivityEvent, PushResult } from '../src/activity/policy.js';
import { createApp } from '../src/api/app.js';
import { loadNoiseModel } from '../src/flights/noise.js';
import { createPositionSource, tileAt, type Feed } from '../src/flights/positions.js';
import { createRouteDirectory } from '../src/flights/routes.js';
import { createSky } from '../src/flights/sky.js';
import { createUserStore, sqliteStorage, type UserStorage } from '../src/users.js';

const TICK_MS = 5000;
const APP_KEY = 'simulation';
const STARTER_PLAN = { perMinute: 60, perMonth: 1_000_000 };

const CITIES = [
  { name: 'Tel Aviv', center: { lat: 32.07, lon: 34.79 }, share: 0.3, utcOffsetMinutes: 120 },
  { name: 'London', center: { lat: 51.5, lon: -0.12 }, share: 0.2, utcOffsetMinutes: 0 },
  { name: 'New York', center: { lat: 40.71, lon: -73.99 }, share: 0.2, utcOffsetMinutes: -300 },
  { name: 'Berlin', center: { lat: 52.52, lon: 13.4 }, share: 0.1, utcOffsetMinutes: 60 },
  { name: 'Paris', center: { lat: 48.86, lon: 2.35 }, share: 0.1, utcOffsetMinutes: 60 },
  { name: 'Dubai', center: { lat: 25.2, lon: 55.27 }, share: 0.1, utcOffsetMinutes: 240 },
];

const { values: args } = parseArgs({
  options: {
    users: { type: 'string', default: '100' },
    traffic: { type: 'string' },
    anp: { type: 'string' },
    seed: { type: 'string', default: '1' },
  },
});
if (!args.traffic) throw new Error('--traffic <sim-traffic.jsonl.gz> is required');

// Seeded randomness, so two runs with the same seed simulate the same people.
let seed = Number(args.seed);
const random = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
const near = ({ lat, lon }: GeoPoint, km: number): GeoPoint => {
  const distance = Math.sqrt(random()) * km;
  const angle = random() * 2 * Math.PI;
  return {
    lat: lat + (distance * Math.cos(angle)) / 111,
    lon: lon + (distance * Math.sin(angle)) / (111 * Math.cos((lat * Math.PI) / 180)),
  };
};

// Replayed traffic: aircraft per tile per 5-second step, as the feed would have answered.
type Row = [
  number,
  string,
  string,
  string,
  string | null,
  number | string,
  number,
  number,
  number | null,
  number,
  number,
];
const traffic = new Map<string, Map<number, object[]>>();
for (const line of gunzipSync(readFileSync(args.traffic)).toString('utf8').split('\n')) {
  if (!line) continue;
  const [t, , hex, flight, type, alt, gs, track, rate, lat, lon] = JSON.parse(line) as Row;
  const key = tileAt({ lat, lon }).key;
  const byTime = traffic.get(key) ?? traffic.set(key, new Map()).get(key)!;
  const aircraft = {
    hex,
    flight,
    t: type ?? undefined,
    alt_baro: alt,
    gs,
    track,
    baro_rate: rate ?? undefined,
    lat,
    lon,
  };
  (byTime.get(t) ?? byTime.set(t, []).get(t)!).push(aircraft);
}
const times = [...new Set([...traffic.values()].flatMap((byTime) => [...byTime.keys()]))].sort(
  (a, b) => a - b,
);
if (times.length === 0) throw new Error(`No traffic for these cities in ${args.traffic}`);
const startS = times[0]!;
const endS = times.at(-1)!;

let nowMs = startS * 1000;
const now = () => nowMs;

const feedCalls: number[] = [];
const replayFeed: Feed = {
  name: 'replay',
  requestGapMs: 0,
  request: (tile) => ({ url: `replay://${tile.key}` }),
};
const replayFetch: typeof fetch = async (input) => {
  feedCalls.push(nowMs);
  const key = String(input).slice('replay://'.length);
  const step = Math.floor(nowMs / 1000 / 5) * 5;
  return new Response(JSON.stringify({ ac: traffic.get(key)?.get(step) ?? [] }));
};

// Count database writes without changing how the store writes.
const dbDir = mkdtempSync(join(tmpdir(), 'overhead-sim-'));
const sqlite = sqliteStorage(join(dbDir, 'sim.db'));
let dbWrites = 0;
const storage: UserStorage = { ...sqlite, write: (user) => (dbWrites++, sqlite.write(user)) };

// Apple push stand-in: answers like APNs and lets the phone report its new card's token, as iOS would.
type Phone = ReturnType<typeof createPhones>[number];
const pushes: { at: number; event: LiveActivityEvent; flight: string; deviceId: string }[] = [];
const phoneByToken = new Map<string, Phone>();
const push = {
  async send(token: string, event: LiveActivityEvent, props: ActivityProps): Promise<PushResult> {
    const phone = phoneByToken.get(token);
    if (!phone) return 'token-invalid';
    pushes.push({ at: nowMs, event, flight: props.flight, deviceId: phone.deviceId });
    if (event === 'start') {
      const cardToken = `card-${phone.deviceId}-${pushes.length}`;
      phoneByToken.set(cardToken, phone);
      phone.cardTokens.push(cardToken);
      phone.due.push({ at: nowMs + 2000, check: true });
    }
    if (event === 'end') phone.cardTokens = phone.cardTokens.filter((card) => card !== token);
    return 'delivered';
  },
};

const users = createUserStore({ storage, now, maxUsers: 20_000 });
const routes = createRouteDirectory();
await routes.load();
const noise = args.anp ? loadNoiseModel(args.anp) : undefined;
const sky = createSky(createPositionSource([replayFeed], { fetchFn: replayFetch, now }), routes, noise);
const watcher = createWatcher({ users, sky, push, now });
const server = createApp({ appKey: APP_KEY, users, watcher }).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const call = (path: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-app-key': APP_KEY } });

// People: a home and a work spot near a city centre, one commute in the window, a couple of app sessions.
function createPhones(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const pick = random();
    let total = 0;
    const city = CITIES.find(({ share }) => (total += share) >= pick) ?? CITIES[0]!;
    const home = near(city.center, 15);
    const windowMs = (endS - startS) * 1000;
    const commuteAt = startS * 1000 + random() * windowMs;
    const sessions = [random(), random()].map((share) => startS * 1000 + share * windowMs);
    return {
      deviceId: `SIM-${String(index).padStart(5, '0')}`,
      city: city.name,
      utcOffsetMinutes: city.utcOffsetMinutes,
      quiet: random() < 0.7,
      location: home,
      work: near(city.center, 15),
      startToken: `start-${index}`,
      cardTokens: [] as string[],
      due: [
        { at: startS * 1000, check: true },
        { at: commuteAt, move: true },
        ...sessions.flatMap((at) =>
          Array.from({ length: 24 }, (_, poll) => ({ at: at + poll * TICK_MS, poll: true })),
        ),
      ] as { at: number; check?: boolean; move?: boolean; poll?: boolean }[],
    };
  });
}

const phones = createPhones(Number(args.users));
for (const phone of phones) phoneByToken.set(phone.startToken, phone);

async function checkIn(phone: Phone): Promise<void> {
  await call('/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: phone.deviceId,
      ...phone.location,
      startToken: phone.startToken,
      activityTokens: phone.cardTokens,
      quietHours: phone.quiet ? QUIET_HOURS : null,
      utcOffsetMinutes: phone.utcOffsetMinutes,
    }),
  });
}

async function runDueEvents(phone: Phone): Promise<void> {
  const due = phone.due.filter(({ at }) => at <= nowMs);
  phone.due = phone.due.filter(({ at }) => at > nowMs);
  for (const event of due) {
    if (event.move) phone.location = phone.work;
    if (event.check || event.move) await checkIn(phone);
    if (event.poll) await call(`/sky?deviceId=${phone.deviceId}`);
  }
}

// Fast-forward through the window one tick at a time, timing only the server's own work.
console.log = () => {};
const ticks: { wallMs: number; cpuMs: number; heapMb: number }[] = [];
const closePasses = new Set<string>();
let peakPushesPerTick = 0;
for (nowMs = startS * 1000; nowMs <= endS * 1000; nowMs += TICK_MS) {
  for (const phone of phones) await runDueEvents(phone);
  const before = pushes.length;
  const cpu = process.cpuUsage();
  const started = performance.now();
  await watcher.tick();
  const used = process.cpuUsage(cpu);
  ticks.push({
    wallMs: performance.now() - started,
    cpuMs: (used.user + used.system) / 1000,
    heapMb: process.memoryUsage().heapUsed / 2 ** 20,
  });
  peakPushesPerTick = Math.max(peakPushesPerTick, pushes.length - before);
  for (const user of users.all()) {
    for (const plane of watcher.planesFor(user)) {
      if (plane.heardDb === undefined && plane.stage !== 'inbound')
        closePasses.add(`${user.deviceId}|${plane.flight}`);
    }
  }
}
server.close();
users.close();
rmSync(dbDir, { recursive: true, force: true });

// Report.
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)]!;
const round = (value: number) => Math.round(value * 10) / 10;
const hours = (endS - startS) / 3600;
const callsPerMinute = new Map<number, number>();
for (const at of feedCalls)
  callsPerMinute.set(Math.floor(at / 60_000), (callsPerMinute.get(Math.floor(at / 60_000)) ?? 0) + 1);
const starts = pushes.filter(({ event }) => event === 'start');
const startsPerPhoneHour = new Map<string, number>();
for (const { deviceId, at } of starts) {
  const key = `${deviceId}|${Math.floor(at / 3_600_000)}`;
  startsPerPhoneHour.set(key, (startsPerPhoneHour.get(key) ?? 0) + 1);
}
const shown = new Set(pushes.map(({ deviceId, flight }) => `${deviceId}|${flight}`));
const closeShown = [...closePasses].filter((pass) => shown.has(pass)).length;
const tiles = new Set(phones.map(({ location }) => tileAt(location).key)).size;
const wall = ticks.map(({ wallMs }) => wallMs);
const cpu = ticks.map(({ cpuMs }) => cpuMs);
const perCity = CITIES.map(({ name }) => `${name} ${phones.filter(({ city }) => city === name).length}`).join(
  ', ',
);

const report = `# Scale simulation: ${phones.length} phones

Run ${new Date().toISOString().slice(0, 10)} on the developer PC with \`npm run simulate -w server\` (seed ${args.seed}).
Real server code (watcher, policy, SQLite store, HTTP API); replayed adsb.lol traffic of ${new Date(startS * 1000).toISOString().slice(0, 10)}, ${new Date(startS * 1000).toISOString().slice(11, 16)}-${new Date(endS * 1000).toISOString().slice(11, 16)} UTC (${round(hours)} h, ${ticks.length} ticks); Apple push counted, not sent. Hearing rule ${noise ? 'on' : 'off (no noise data given)'}.

## Setup

- Phones: ${phones.length} (${perCity}), in ${tiles} feed tiles; 70% with quiet hours; one commute and two app sessions of 2 minutes each per phone.

## Server

- Tick (5 s budget): median ${round(percentile(wall, 0.5))} ms, p95 ${round(percentile(wall, 0.95))} ms, max ${round(Math.max(...wall))} ms of wall time.
- CPU per tick: median ${round(percentile(cpu, 0.5))} ms, p95 ${round(percentile(cpu, 0.95))} ms.
- Heap: up to ${round(Math.max(...ticks.map(({ heapMb }) => heapMb)))} MB (includes the replayed traffic and the route list).
- Database writes: ${dbWrites} (${round(dbWrites / ticks.length)} per tick).

## Feed

- Requests: ${feedCalls.length} (${round(feedCalls.length / (hours * 60))} a minute on average, ${Math.max(...callsPerMinute.values())} at most). Starter allows ${STARTER_PLAN.perMinute} a minute.
- Month at this rate: about ${Math.round((feedCalls.length / hours) * 24 * 30).toLocaleString('en')} requests; Starter allows ${STARTER_PLAN.perMonth.toLocaleString('en')}.

## Cards and Apple push

- Pushes: ${pushes.length} (${starts.length} starts, ${pushes.filter(({ event }) => event === 'update').length} updates, ${pushes.filter(({ event }) => event === 'end').length} ends); at most ${peakPushesPerTick} in one tick.
- Starts per phone per hour: at most ${Math.max(0, ...startsPerPhoneHour.values())} (limit 10).
- Close passes (planes that reached Approaching or Above you) shown on a card: ${closeShown} of ${closePasses.size} (${closePasses.size ? Math.round((100 * closeShown) / closePasses.size) : 0}%).
`;
writeFileSync(
  join(import.meta.dirname, '..', '..', 'docs', 'research', `simulation-${phones.length}.md`),
  report,
);
process.stdout.write(report);
process.exit(0);
