import type { NearbyPlane, RegisterRequest } from '@overhead/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWatcher, type Watcher } from '../src/activity/watcher.js';
import { pushPriority } from '../src/push/apns.js';
import { createUserStore, type User, type UserStore } from '../src/users.js';
import { FakePush, FakeSky, nearbyPlane, registerRequest } from './fakes.js';

const TICK_MS = 5000;
const MINUTE_MS = 60_000;
const IOS_URGENT_PUSHES_PER_HOUR = 12;
const APP_CLOSES_CARDS_AFTER_MS = 30 * MINUTE_MS;

const TEL_AVIV = { lat: 32.081, lon: 34.814 };
const BERLIN = { lat: 52.52, lon: 13.405 };

class World {
  now = Date.UTC(2026, 10, 1, 12);
  readonly sky = new FakeSky();
  readonly push = new FakePush();
  users: UserStore = createUserStore();
  watcher: Watcher = this.createWatcher();
  readonly sentAt: number[] = [];
  private cardsIssued = 0;

  join(overrides: Partial<RegisterRequest> = {}): User {
    return this.users.upsert(registerRequest(overrides));
  }

  restartServer(): void {
    this.users = createUserStore();
    this.watcher = this.createWatcher();
  }

  async run(durationMs: number, planesAt?: (elapsedMs: number) => NearbyPlane[]): Promise<void> {
    const startedAt = this.now;
    while (this.now - startedAt < durationMs) {
      this.now += TICK_MS;
      if (planesAt) this.sky.planes = planesAt(this.now - startedAt);
      const sentBefore = this.push.sent.length;
      await this.watcher.tick();
      while (this.sentAt.length < this.push.sent.length) this.sentAt.push(this.now);
      await this.confirmNewCards(sentBefore);
    }
  }

  pushes(event?: 'start' | 'update' | 'end') {
    return this.push.sent
      .map((sent, index) => ({ ...sent, at: this.sentAt[index] ?? this.now }))
      .filter((sent) => !event || sent.event === event);
  }

  private async confirmNewCards(sentBefore: number): Promise<void> {
    for (const { event, token } of this.push.sent.slice(sentBefore)) {
      const user = this.users.all().find((candidate) => candidate.startToken === token);
      if (event !== 'start' || !user?.activity.showing) continue;
      this.cardsIssued += 1;
      await this.watcher.reportActivityTokens(user, [`card-${this.cardsIssued}`]);
    }
  }

  private createWatcher(): Watcher {
    return createWatcher({ users: this.users, sky: this.sky, push: this.push, now: () => this.now });
  }
}

const passing =
  (flight: string, fromMs: number, seconds: number, overrides: Partial<NearbyPlane> = {}) =>
  (elapsedMs: number): NearbyPlane[] => {
    const secondsLeft = Math.round((fromMs + seconds * 1000 - elapsedMs) / 1000);
    return elapsedMs >= fromMs && secondsLeft > 0 ? [nearbyPlane(flight, { secondsLeft, ...overrides })] : [];
  };

const together =
  (...skies: ((elapsedMs: number) => NearbyPlane[])[]) =>
  (elapsedMs: number) =>
    skies.flatMap((sky) => sky(elapsedMs));

describe('real-world situations', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('keeps one card through a short gap in ADS-B coverage', async () => {
    world.join();
    const plane = passing('ELY001', 0, 120);
    const withGap = (elapsedMs: number) =>
      elapsedMs > 40_000 && elapsedMs <= 55_000 ? [] : plane(elapsedMs);

    await world.run(5 * MINUTE_MS, withGap);

    expect(world.pushes('start')).toHaveLength(1);
    expect(world.pushes('end')).toHaveLength(1);
  });

  it('ends the card when the position feed goes down mid-pass', async () => {
    world.join();
    await world.run(30_000, passing('ELY001', 0, 600));

    world.sky.feedDown = true;
    await world.run(3 * MINUTE_MS);

    expect(world.pushes('end')).toHaveLength(1);
  });

  it('does not show a hovering helicopter again after an airliner passes beneath it', async () => {
    world.join();
    const helicopter = (elapsedMs: number) =>
      elapsedMs < 40 * MINUTE_MS ? [nearbyPlane('POLICE1', { secondsLeft: 60, distanceNm: 0.8 })] : [];
    const airliner = passing('ELY001', 15 * MINUTE_MS, 90, { distanceNm: 0.3 });

    await world.run(45 * MINUTE_MS, (elapsedMs) =>
      [...airliner(elapsedMs), ...helicopter(elapsedMs)].sort((a, b) => a.distanceNm - b.distanceNm),
    );

    const airlinerGoneAt = world.now - 45 * MINUTE_MS + 15 * MINUTE_MS + 90_000;
    const helicopterShownAgain = world
      .pushes()
      .filter(({ at, event, props }) => at > airlinerGoneAt && event !== 'end' && props.flight === 'POLICE1');
    expect(helicopterShownAgain).toEqual([]);
    expect(world.pushes('start').map(({ props }) => props.flight)).toEqual(['POLICE1', 'ELY001']);
  });

  it('ends the card soon after quiet hours begin', async () => {
    world.now = Date.UTC(2026, 10, 1, 19, 58);
    world.join({ quietHours: [22 * 60, 7 * 60], utcOffsetMinutes: 120 });

    await world.run(5 * MINUTE_MS, passing('ELY001', 0, 30 * 60));

    const end = world.pushes('end')[0];
    expect(end).toBeDefined();
    expect(world.pushes('start')).toHaveLength(1);
  });

  it('lets the current card finish but starts no new one after Live Activities are turned off', async () => {
    const user = world.join();
    await world.run(30_000, passing('ELY001', 0, 90));

    world.join({ startToken: undefined, activityTokens: [...user.activityTokens] });
    await world.run(
      10 * MINUTE_MS,
      together(passing('ELY001', -30_000, 90), passing('WZZ63', 5 * MINUTE_MS, 90)),
    );

    expect(world.pushes('start').map(({ props }) => props.flight)).toEqual(['ELY001']);
    expect(world.pushes('end')).toHaveLength(1);
  });

  it('closes a card left on the phone from before a server restart', async () => {
    world.join();
    await world.run(30_000, passing('ELY001', 0, 600));

    world.restartServer();
    const user = world.join();
    await world.watcher.reportActivityTokens(user, ['card-1']);

    expect(world.pushes('end')).toMatchObject([{ token: 'card-1' }]);
  });

  it('follows the user when they drive somewhere else', async () => {
    world.sky.planesAt = (point) => (point.lat === BERLIN.lat ? [nearbyPlane('EZY123')] : []);
    world.join(TEL_AVIV);
    await world.run(MINUTE_MS);
    expect(world.pushes('start')).toHaveLength(0);

    world.join(BERLIN);
    await world.run(MINUTE_MS);

    expect(world.pushes('start').map(({ props }) => props.flight)).toEqual(['EZY123']);
  });

  it('gives users in different cities their own cards', async () => {
    world.sky.planesAt = (point) => (point.lat === TEL_AVIV.lat ? [nearbyPlane('ELY001')] : []);
    world.join({ ...TEL_AVIV, deviceId: 'tel-aviv', startToken: 'tel-aviv-start' });
    world.join({ ...BERLIN, deviceId: 'berlin', startToken: 'berlin-start' });

    await world.run(MINUTE_MS);

    expect(world.pushes('start').map(({ token }) => token)).toEqual(['tel-aviv-start']);
  });

  it('keeps serving other users while one of them cannot be watched', async () => {
    world.sky.planesAt = (point) => {
      if (point.lat === BERLIN.lat) throw new Error('adsb.fi responded 429');
      return [nearbyPlane('ELY001')];
    };
    world.join({ ...BERLIN, deviceId: 'berlin', startToken: 'berlin-start' });
    world.join({ ...TEL_AVIV, deviceId: 'tel-aviv', startToken: 'tel-aviv-start' });

    await world.run(MINUTE_MS);

    expect(world.pushes('start').map(({ token }) => token)).toEqual(['tel-aviv-start']);
  });

  describe('under a busy approach path, a plane every 90 seconds for three hours', () => {
    const approachPath = (elapsedMs: number): NearbyPlane[] => {
      const slot = Math.floor(elapsedMs / 90_000);
      const intoSlot = (elapsedMs % 90_000) / 1000;
      return intoSlot < 60 ? [nearbyPlane(`ELY${slot}`, { secondsLeft: Math.round(60 - intoSlot) })] : [];
    };

    beforeEach(async () => {
      world.join();
      await world.run(3 * 60 * MINUTE_MS, approachPath);
    });

    it('stays inside the iOS budget for urgent pushes in every hour', () => {
      const urgent = world.pushes().filter(({ event }) => pushPriority(event) === '10');
      for (const { at } of urgent) {
        const inNextHour = urgent.filter((other) => other.at >= at && other.at < at + 60 * MINUTE_MS);
        expect(inNextHour.length).toBeLessThanOrEqual(IOS_URGENT_PUSHES_PER_HOUR);
      }
    });

    it('never has more than one card open at a time', () => {
      let open = 0;
      for (const { event } of world.pushes()) {
        if (event === 'start') open += 1;
        if (event === 'end') open -= 1;
        expect(open).toBeLessThanOrEqual(1);
      }
    });

    it('renews each card before the app would close it on its own', () => {
      const starts = world.pushes('start');
      const ends = world.pushes('end');
      starts.forEach((start, index) => {
        const closedAt = ends[index]?.at ?? world.now;
        expect(closedAt - start.at).toBeLessThan(APP_CLOSES_CARDS_AFTER_MS);
      });
    });
  });
});
