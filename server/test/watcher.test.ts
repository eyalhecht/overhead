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

  it('watches the demo spot for the named phone only', async () => {
    const lax = { lat: 33.95, lon: -118.33 };
    const watched: string[] = [];
    sky.planesAt = (point) => {
      watched.push(point.lat === lax.lat ? 'demo spot' : 'own location');
      return [];
    };
    watcher = createWatcher({ users, sky, push, now: () => now, demoLocation: lax, demoDevice: 'phone-1' });
    users.upsert(registerRequest({ deviceId: 'phone-2', startToken: 'start-token-2' }));

    await watcher.tick();

    expect(watched.sort()).toEqual(['demo spot', 'own location']);
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

  it('refreshes the sky once per tick for every phone, leaving out phones in quiet hours', async () => {
    users.upsert(registerRequest({ deviceId: 'phone-2', startToken: 'start-token-2', lat: 10 }));
    users.upsert(
      registerRequest({ deviceId: 'phone-3', startToken: 'start-token-3', lat: 20, quietHours: [0, 1439] }),
    );

    await watcher.tick();

    expect(sky.refreshedFor).toHaveLength(1);
    expect(sky.refreshedFor[0]?.map(({ lat }) => lat).sort()).toEqual([10, user.location.lat].sort());
  });

  describe('which phones are watched', () => {
    const silent = () =>
      users.upsert(registerRequest({ deviceId: 'phone-2', startToken: undefined, lat: 10 }));

    it('skips a phone that cannot get a card: no start token, no card open, app closed', async () => {
      silent();
      await watcher.tick();
      expect(sky.refreshedFor[0]?.map(({ lat }) => lat)).toEqual([user.location.lat]);
    });

    it('watches it while its app is open, so the app can show the sky', async () => {
      watcher.appOpened(silent());
      await watcher.tick();
      expect(sky.refreshedFor[0]).toHaveLength(2);
    });

    it('keeps watching a phone whose start token is gone while its card is still open', async () => {
      sky.planes = [nearbyPlane('BAW1')];
      await watcher.tick();
      user.startToken = undefined;
      await watcher.tick();
      expect(sky.refreshedFor[1]).toHaveLength(1);
    });
  });

  it('keeps watching other phones while one phone waits on a slow push', async () => {
    users.upsert(registerRequest({ deviceId: 'phone-2', startToken: 'start-token-2', lat: 10 }));
    sky.planes = [nearbyPlane('BAW1')];
    let releaseSlowPush = () => {};
    const send = push.send.bind(push);
    push.send = (token, event, props) =>
      token === 'start-token'
        ? new Promise((resolve) => (releaseSlowPush = () => resolve('delivered')))
        : send(token, event, props);

    const tick = watcher.tick();
    await vi.waitFor(() => expect(push.sent.map(({ token }) => token)).toEqual(['start-token-2']));
    releaseSlowPush();
    await tick;
  });

  it('finishes the tick in progress before stopping', async () => {
    let releaseFeed = () => {};
    sky.planes = [nearbyPlane('BAW1')];
    sky.refresh = () => new Promise((resolve) => (releaseFeed = () => resolve()));
    vi.useFakeTimers();
    watcher.start();
    await vi.advanceTimersByTimeAsync(5000);
    let stopped = false;
    const stopping = watcher.stop().then(() => (stopped = true));
    await Promise.resolve();
    expect(stopped).toBe(false);
    releaseFeed();
    await stopping;
    vi.useRealTimers();
    expect(push.sent.map(({ event }) => event)).toEqual(['start']);
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
    expect(user.activity.recentStarts).toHaveLength(2);
  });

  it('sends no more than the hourly limit of starts while Apple keeps rejecting them', async () => {
    push.result = 'failed';
    sky.planes = [nearbyPlane('ETD9702')];
    for (let tick = 0; tick < 60; tick += 1) await tickAfter(5000);

    const starts = push.sent.filter(({ event }) => event === 'start');
    expect(starts).toHaveLength(ACTIVITY_RULES.maxStartsPerHour);
  });

  it('keeps a new start token when a push to the old one comes back invalid', async () => {
    let answerOldPush: (() => void) | undefined;
    push.send = (token) =>
      new Promise((resolve) => {
        answerOldPush = () => resolve(token === 'start-token' ? 'token-invalid' : 'delivered');
      });
    sky.planes = [nearbyPlane('BAW1')];
    const tick = watcher.tick();
    await vi.waitFor(() => expect(answerOldPush).toBeDefined());
    users.upsert(registerRequest({ startToken: 'new-start-token' }));
    answerOldPush?.();
    await tick;
    expect(user.startToken).toBe('new-start-token');
  });

  it('forgets a start token that Apple reports as invalid', async () => {
    push.result = 'token-invalid';
    sky.planes = [nearbyPlane('BAW1')];
    await watcher.tick();
    expect(user.startToken).toBeUndefined();
  });
});
