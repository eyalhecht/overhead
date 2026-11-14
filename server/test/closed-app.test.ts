import type { GeoPoint } from '@overhead/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_RULES } from '../src/activity/policy.js';
import { createWatcher, type Watcher } from '../src/activity/watcher.js';
import { createApp } from '../src/api/app.js';
import { createUserStore, type UserStore } from '../src/users.js';
import { FakePush, FakeSky, nearbyPlane, registerRequest } from './fakes.js';

const APP_KEY = 'test-key';
const HOME = { lat: 32.064, lon: 34.836 };
const PARK = { lat: 32.047, lon: 34.82 };

describe('with the app closed', () => {
  let sky: FakeSky;
  let push: FakePush;
  let users: UserStore;
  let watcher: Watcher;
  let app: ReturnType<typeof createApp>;
  let now: number;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sky = new FakeSky();
    push = new FakePush();
    users = createUserStore();
    now = Date.UTC(2026, 10, 13, 15, 0);
    watcher = createWatcher({ users, sky, push, now: () => now });
    app = createApp({ appKey: APP_KEY, users, watcher, now: () => now });
  });

  const backgroundCheckIn = (where: GeoPoint, activityTokens: string[] = []) =>
    request(app)
      .post('/register')
      .set('x-app-key', APP_KEY)
      .send(registerRequest({ ...where, activityTokens, utcOffsetMinutes: 120 }))
      .expect(204);

  const tickAfter = async (ms: number) => {
    now += ms;
    await watcher.tick();
  };

  const sentAs = () => push.sent.map(({ token, event, props }) => `${event}:${token}:${props.flight}`);

  const planeOnlyNear = (spot: GeoPoint, flight: string) => {
    sky.planesAt = (point) =>
      point.lat === spot.lat && point.lon === spot.lon ? [nearbyPlane(flight, { stage: 'approaching' })] : [];
  };

  it('starts a card from the start token, then updates and ends it on the token the phone reports in the background', async () => {
    await backgroundCheckIn(HOME);
    sky.planes = [nearbyPlane('UAL140', { stage: 'approaching' })];
    await tickAfter(5000);
    await backgroundCheckIn(HOME, ['card-1']);
    sky.planes = [nearbyPlane('UAL140', { stage: 'overhead' })];
    await tickAfter(5000);
    sky.planes = [];
    await tickAfter(5000);
    await tickAfter(ACTIVITY_RULES.passedLingerMs);

    expect(sentAs()).toEqual([
      'start:start-token:UAL140',
      'update:card-1:UAL140',
      'update:card-1:UAL140',
      'update:card-1:UAL140',
      'end:card-1:UAL140',
    ]);
  });

  it('measures planes from where the phone last reported, so a move it never reports means no card', async () => {
    await backgroundCheckIn(HOME);
    planeOnlyNear(PARK, 'SWR252B');
    await tickAfter(5000);
    expect(push.sent).toEqual([]);

    await backgroundCheckIn(PARK);
    await tickAfter(5000);
    expect(sentAs()).toEqual(['start:start-token:SWR252B']);
  });

  it('holds new cards when a force-quit app never reports its card, until the app checks in again', async () => {
    await backgroundCheckIn(HOME);
    sky.planes = [nearbyPlane('CHZ674', { stage: 'approaching' })];
    await tickAfter(5000);
    await tickAfter(ACTIVITY_RULES.tokenWaitMs + 5000);

    sky.planes = [nearbyPlane('WMT5012', { stage: 'approaching' })];
    await tickAfter(5000);
    expect(sentAs()).toEqual(['start:start-token:CHZ674']);

    await tickAfter(3 * 60 * 60_000);
    expect(sentAs()).toEqual(['start:start-token:CHZ674']);

    await backgroundCheckIn(HOME);
    await tickAfter(5000);
    expect(sentAs()).toEqual(['start:start-token:CHZ674', 'start:start-token:WMT5012']);
  });

  it('keeps quiet hours while the app is closed', async () => {
    await request(app)
      .post('/register')
      .set('x-app-key', APP_KEY)
      .send(registerRequest({ ...HOME, quietHours: [22 * 60, 7 * 60], utcOffsetMinutes: 120 }))
      .expect(204);
    now = Date.UTC(2026, 10, 13, 21, 0);
    sky.planes = [nearbyPlane('ELY2', { stage: 'overhead' })];
    await tickAfter(5000);

    expect(push.sent).toEqual([]);
  });
});
