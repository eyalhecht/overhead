import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.spyOn(console, 'log').mockImplementation(() => {});
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
    sky.planes = [nearbyPlane('BAW1', { stage: 'approaching' })];
    await watcher.tick();
    await watcher.reportCardTokens(user, ['card-1']);
    sky.planes = [nearbyPlane('BAW1', { stage: 'overhead' })];
    await tickAfter(5000);
    sky.planes = [];
    await tickAfter(5000);
    await tickAfter(ACTIVITY_RULES.passedLingerMs);

    expect(push.sent.map(({ token, event, props }) => `${event}:${token}:${props.stage}`)).toEqual([
      'start:start-token:approaching',
      'update:card-1:approaching',
      'update:card-1:overhead',
      'update:card-1:passed',
      'end:card-1:passed',
    ]);
    expect(user.activity.cardTokens).toEqual([]);
  });

  it('shows planes without a known route', async () => {
    sky.planes = [nearbyPlane('4XCDO', { route: null })];
    await watcher.tick();
    expect(push.sent).toMatchObject([{ event: 'start', props: { flight: '4XCDO', route: null } }]);
  });

  it('ends a card at once when its token arrives after the plane has gone', async () => {
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    sky.planes = [];
    await tickAfter(5000);
    await tickAfter(ACTIVITY_RULES.passedLingerMs);
    await watcher.reportCardTokens(user, ['late-card']);

    expect(push.sent.at(-1)).toMatchObject({ event: 'end', token: 'late-card', props: { flight: 'BAW1' } });
  });

  it('stays silent during quiet hours', async () => {
    user = users.upsert(registerRequest({ quietHours: [0, 1439] }));
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    expect(push.sent).toEqual([]);
  });

  it('retries a start that failed to send instead of pausing new cards', async () => {
    push.result = 'failed';
    sky.planes = [nearbyPlane('ETD9702')];
    await watcher.tick();
    push.result = 'delivered';
    await tickAfter(5000);
    await watcher.reportCardTokens(user, ['card-1']);
    await tickAfter(ACTIVITY_RULES.tokenWaitMs + 5000);

    expect(push.sent.map(({ event, token }) => `${event}:${token}`)).toEqual([
      'start:start-token',
      'start:start-token',
      'update:card-1',
      'update:card-1',
    ]);
    expect(user.activity.pausedUntil).toBeUndefined();
    expect(user.activity.recentStarts).toHaveLength(1);
  });

  it('forgets a start token that Apple reports as invalid', async () => {
    push.result = 'token-invalid';
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    expect(user.startToken).toBeUndefined();
  });
});
