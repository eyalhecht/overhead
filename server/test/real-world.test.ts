import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CARD_MAX_AGE_MS, type NearbyPlane, type PassStage, type RegisterRequest } from '@overhead/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_RULES } from '../src/activity/policy.js';
import { createWatcher, type Watcher } from '../src/activity/watcher.js';
import { pushPriority } from '../src/push/apns.js';
import {
  createUserStore,
  memoryStorage,
  sqliteStorage,
  type User,
  type UserStorage,
  type UserStore,
} from '../src/users.js';
import { FakePush, FakeSky, nearbyPlane, registerRequest } from './fakes.js';

const TICK_MS = 5000;
const MINUTE_MS = 60_000;
const IOS_URGENT_PUSHES_PER_HOUR = 12;

const TEL_AVIV = { lat: 32.081, lon: 34.814 };
const BERLIN = { lat: 52.52, lon: 13.405 };

class World {
  now = Date.UTC(2026, 10, 1, 12);
  readonly sky = new FakeSky();
  readonly push = new FakePush();
  users: UserStore;
  watcher: Watcher;
  readonly sentAt: number[] = [];
  private cardsIssued = 0;

  constructor(private readonly storage: () => UserStorage = memoryStorage) {
    this.users = this.openUsers();
    this.watcher = this.createWatcher();
  }

  join(overrides: Partial<RegisterRequest> = {}): User {
    return this.users.upsert(registerRequest(overrides));
  }

  restartServer(): void {
    this.users.close();
    this.users = this.openUsers();
    this.watcher = this.createWatcher();
  }

  private openUsers(): UserStore {
    return createUserStore({ storage: this.storage(), now: () => this.now });
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
      await this.watcher.reportCardTokens(user, [`card-${this.cardsIssued}`]);
    }
  }

  private createWatcher(): Watcher {
    return createWatcher({ users: this.users, sky: this.sky, push: this.push, now: () => this.now });
  }
}

const INBOUND_MS = 75_000;
const APPROACHING_MS = 45_000;
const STAGE_ORDER: PassStage[] = ['overhead', 'approaching', 'inbound'];

function stageAt(intoPassMs: number, overheadMs: number): PassStage | null {
  if (intoPassMs < 0) return null;
  if (intoPassMs < INBOUND_MS) return 'inbound';
  if (intoPassMs < INBOUND_MS + APPROACHING_MS) return 'approaching';
  return intoPassMs < INBOUND_MS + APPROACHING_MS + overheadMs ? 'overhead' : null;
}

const passing =
  (flight: string, firstSeenAtMs: number, overheadSeconds: number, overrides: Partial<NearbyPlane> = {}) =>
  (elapsedMs: number): NearbyPlane[] => {
    const stage = stageAt(elapsedMs - firstSeenAtMs, overheadSeconds * 1000);
    return stage ? [nearbyPlane(flight, { stage, ...overrides })] : [];
  };

const together =
  (...skies: ((elapsedMs: number) => NearbyPlane[])[]) =>
  (elapsedMs: number) =>
    skies
      .flatMap((sky) => sky(elapsedMs))
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

const UNTIL_OVERHEAD_MS = INBOUND_MS + APPROACHING_MS + 5000;

describe('real-world situations', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('keeps one card through a short gap in ADS-B coverage', async () => {
    world.join();
    const plane = passing('ELY001', 0, 90);
    const withGap = (elapsedMs: number) =>
      elapsedMs > 150_000 && elapsedMs <= 160_000 ? [] : plane(elapsedMs);

    await world.run(5 * MINUTE_MS, withGap);

    expect(world.pushes('start')).toHaveLength(1);
    expect(world.pushes('end')).toHaveLength(1);
  });

  it('ends the card when the position feed goes down mid-pass', async () => {
    world.join();
    await world.run(UNTIL_OVERHEAD_MS, passing('ELY001', 0, 600));

    world.sky.feedDown = true;
    await world.run(3 * MINUTE_MS);

    expect(world.pushes('end')).toHaveLength(1);
  });

  it('does not show a circling helicopter again after an airliner passes beneath it', async () => {
    world.join();
    const startedAt = world.now;
    const helicopter = (elapsedMs: number) =>
      elapsedMs < 40 * MINUTE_MS ? [nearbyPlane('POL1', { distanceNm: 0.8 })] : [];
    const airliner = passing('ELY001', 15 * MINUTE_MS, 90, { distanceNm: 0.3 });

    await world.run(45 * MINUTE_MS, together(airliner, helicopter));

    const airlinerGoneAt = startedAt + 15 * MINUTE_MS + UNTIL_OVERHEAD_MS + 90_000;
    const helicopterShownAgain = world
      .pushes()
      .filter(({ at, event, props }) => at > airlinerGoneAt && event !== 'end' && props.flight === 'POL1');
    expect(helicopterShownAgain).toEqual([]);
    expect(world.pushes('start').map(({ props }) => props.flight)).toEqual(['POL1', 'ELY001']);
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
    await world.run(UNTIL_OVERHEAD_MS, passing('ELY001', 0, 90));

    world.join({ startToken: null, activityTokens: [...user.activity.cardTokens] });
    await world.run(
      10 * MINUTE_MS,
      together(passing('ELY001', -UNTIL_OVERHEAD_MS, 90), passing('WZZ63', 5 * MINUTE_MS, 90)),
    );

    expect(world.pushes('start').map(({ props }) => props.flight)).toEqual(['ELY001']);
    expect(world.pushes('end')).toHaveLength(1);
  });

  it('closes a card left on the phone from before a server restart', async () => {
    world.join();
    await world.run(UNTIL_OVERHEAD_MS, passing('ELY001', 0, 600));

    world.restartServer();
    const user = world.join();
    await world.watcher.reportCardTokens(user, ['card-1']);

    expect(world.pushes('end')).toMatchObject([{ token: 'card-1' }]);
  });

  it('keeps a card going through a server restart when users are saved', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'overhead-world-'));
    const saved = new World(() => sqliteStorage(join(folder, 'overhead.db')));
    saved.join();
    await saved.run(UNTIL_OVERHEAD_MS, passing('ELY001', 0, 600));
    const sentBeforeRestart = saved.pushes().length;

    saved.restartServer();
    await saved.run(TICK_MS * 8, passing('ELY001', 0, 600));
    saved.users.close();
    rmSync(folder, { recursive: true, force: true });

    expect(saved.pushes('start')).toHaveLength(1);
    expect(saved.pushes().slice(sentBeforeRestart)).toMatchObject([{ event: 'update', token: 'card-1' }]);
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
      if (point.lat === BERLIN.lat) throw new Error('adsb.lol responded 429');
      return [nearbyPlane('ELY001')];
    };
    world.join({ ...BERLIN, deviceId: 'berlin', startToken: 'berlin-start' });
    world.join({ ...TEL_AVIV, deviceId: 'tel-aviv', startToken: 'tel-aviv-start' });

    await world.run(MINUTE_MS);

    expect(world.pushes('start').map(({ token }) => token)).toEqual(['tel-aviv-start']);
  });

  describe('under a busy approach path, a plane every 2 minutes for three hours', () => {
    const PLANES = 3 * 30;
    const approachPath = together(
      ...Array.from({ length: PLANES }, (_, index) => passing(`ELY${index}`, index * 120_000, 30)),
    );

    beforeEach(async () => {
      world.join();
      await world.run(3 * 60 * MINUTE_MS, approachPath);
    });

    it('keeps one card that switches between planes, instead of a new card per plane', () => {
      const renewalsInThreeHours = (3 * 60 * MINUTE_MS) / ACTIVITY_RULES.renewAfterMs;
      expect(world.pushes('start').length).toBeLessThanOrEqual(renewalsInThreeHours + 1);
      expect(new Set(world.pushes('update').map(({ props }) => props.flight)).size).toBeGreaterThan(
        PLANES / 2,
      );
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
        expect(closedAt - start.at).toBeLessThan(CARD_MAX_AGE_MS);
      });
    });
  });

  describe('in a quiet suburb with one or two planes an hour, over five hours', () => {
    const flights = ['ELY001', 'ETD9702', 'ETD594', 'WZZ63', 'UAL90', 'AEE926', 'DLH686'];
    const quietSuburb = together(
      passing('ELY001', 9 * MINUTE_MS, 70),
      passing('ETD9702', 41 * MINUTE_MS, 90),
      passing('ETD594', 43 * MINUTE_MS, 80),
      passing('WZZ63', 96 * MINUTE_MS, 60),
      passing('UAL90', 150 * MINUTE_MS, 110),
      passing('AEE926', 205 * MINUTE_MS, 75),
      passing('DLH686', 262 * MINUTE_MS, 95),
    );
    const shownFlights = () =>
      new Set(
        world
          .pushes()
          .filter(({ event }) => event !== 'end')
          .map(({ props }) => props.flight),
      );

    it('shows every plane, never pauses and closes every card afterwards', async () => {
      const user = world.join();
      await world.run(5 * 60 * MINUTE_MS, quietSuburb);

      expect(flights.every((flight) => shownFlights().has(flight))).toBe(true);
      expect(world.pushes('start').length).toBeLessThanOrEqual(flights.length);
      expect(world.pushes('end')).toHaveLength(world.pushes('start').length);
      expect(user.activity.pausedUntil).toBeUndefined();
      expect(user.activity.cardTokens).toEqual([]);
    });

    it('still shows the first plane when its push hits a dropped connection', async () => {
      const user = world.join();
      const send = world.push.send.bind(world.push);
      let failuresLeft = 1;
      world.push.send = async (token, event, props) => {
        if (event === 'start' && failuresLeft > 0) {
          failuresLeft -= 1;
          return 'failed';
        }
        return send(token, event, props);
      };

      await world.run(15 * MINUTE_MS, quietSuburb);

      expect(shownFlights()).toContain('ELY001');
      expect(user.activity.pausedUntil).toBeUndefined();
    });
  });
});
