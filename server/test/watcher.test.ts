import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVITY_RULES } from '../src/activity/policy.js';
import { createWatcher, type Watcher } from '../src/activity/watcher.js';
import { createUserStore, type User, type UserStore } from '../src/users.js';
import { FakePush, FakeSky, nearbyPlane, registerRequest } from './fakes.js';

describe('watcher', () => {
  let sky: FakeSky;
  let push: FakePush;
  let users: UserStore;
  let watcher: Watcher;
  let user: User;
  let now: number;

  beforeEach(() => {
    sky = new FakeSky();
    push = new FakePush();
    users = createUserStore();
    now = Date.UTC(2026, 9, 30, 12);
    watcher = createWatcher({ users, sky, push, now: () => now });
    user = users.upsert(registerRequest());
  });

  const tickAfter = async (ms: number) => {
    now += ms;
    await watcher.tick();
  };

  it('starts a card on the start token, then updates and ends it on the card token', async () => {
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    await watcher.reportActivityTokens(user, ['card-1']);
    await tickAfter(ACTIVITY_RULES.refreshIntervalMs);
    sky.planes = [];
    await tickAfter(5000);
    await tickAfter(ACTIVITY_RULES.gracePeriodMs);

    expect(push.sent.map(({ token, event }) => `${event}:${token}`)).toEqual([
      'start:start-token',
      'update:card-1',
      'end:card-1',
    ]);
    expect(user.activityTokens.size).toBe(0);
  });

  it('skips planes without a known route', async () => {
    sky.planes = [nearbyPlane('UNKNOWN', { route: null })];
    await watcher.tick();
    expect(push.sent).toEqual([]);
  });

  it('ends a card at once when its token arrives after the plane has gone', async () => {
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    sky.planes = [];
    await tickAfter(ACTIVITY_RULES.gracePeriodMs + 5000);
    await watcher.reportActivityTokens(user, ['late-card']);

    expect(push.sent.at(-1)).toMatchObject({ event: 'end', token: 'late-card', props: { flight: 'BAW1' } });
  });

  it('stays silent during quiet hours', async () => {
    user = users.upsert(registerRequest({ quietHours: [0, 1439] }));
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    expect(push.sent).toEqual([]);
  });

  it('forgets a start token that Apple reports as invalid', async () => {
    push.result = 'token-invalid';
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    expect(user.startToken).toBeUndefined();
  });
});
