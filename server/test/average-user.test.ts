import type { NearbyPlane } from '@overhead/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_RULES } from '../src/activity/policy.js';
import { createWatcher } from '../src/activity/watcher.js';
import type { Sky } from '../src/flights/sky.js';
import { createUserStore } from '../src/users.js';
import { FakePush, nearbyPlane, registerRequest } from './fakes.js';

interface Pass {
  flight: string;
  atMinute: number;
  seconds: number;
}

const TICK_MS = 5000;
const SIMULATED_HOURS = 5;
const MINUTE_MS = 60_000;

const QUIET_SUBURB: Pass[] = [
  { flight: 'ELY001', atMinute: 9, seconds: 70 },
  { flight: 'ETD9702', atMinute: 41, seconds: 90 },
  { flight: 'ETD594', atMinute: 43, seconds: 80 },
  { flight: 'WZZ63', atMinute: 96, seconds: 60 },
  { flight: 'UAL90', atMinute: 150, seconds: 110 },
  { flight: 'AEE926', atMinute: 205, seconds: 75 },
  { flight: 'DLH686', atMinute: 262, seconds: 95 },
];

class ScheduledSky implements Sky {
  constructor(
    private readonly passes: Pass[],
    private readonly startedAt: number,
    private readonly now: () => number,
  ) {}

  async planesAbove(): Promise<NearbyPlane[]> {
    return this.passes.flatMap((pass) => {
      const enteredAt = this.startedAt + pass.atMinute * MINUTE_MS;
      const secondsLeft = Math.round((enteredAt + pass.seconds * 1000 - this.now()) / 1000);
      const overhead = this.now() >= enteredAt && secondsLeft > 0;
      return overhead ? [nearbyPlane(pass.flight, { secondsLeft })] : [];
    });
  }
}

async function simulateDay(passes: Pass[], push = new FakePush()) {
  const startedAt = Date.UTC(2026, 10, 1, 12);
  let now = startedAt;
  const users = createUserStore();
  const user = users.upsert(registerRequest());
  const watcher = createWatcher({
    users,
    sky: new ScheduledSky(passes, startedAt, () => now),
    push,
    now: () => now,
  });

  const shownFlights = new Set<string>();
  let cardsIssued = 0;
  let pauses = 0;

  for (; now < startedAt + SIMULATED_HOURS * 60 * MINUTE_MS; now += TICK_MS) {
    const sentBefore = push.sent.length;
    await watcher.tick();
    if (user.activity.pausedUntil !== undefined) pauses += 1;

    for (const { event, props } of push.sent.slice(sentBefore)) {
      if (event === 'end') continue;
      shownFlights.add(props.flight);
      if (props.second) shownFlights.add(props.second.flight);
    }
    const startDelivered = push.sent.slice(sentBefore).some(({ event }) => event === 'start');
    if (startDelivered && user.activity.showing) {
      cardsIssued += 1;
      await watcher.reportActivityTokens(user, [`card-${cardsIssued}`]);
    }
  }

  return { user, push, shownFlights, cardsIssued, pauses };
}

describe('an average user with one or two planes an hour', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('shows every plane that passes overhead and closes each card afterwards', async () => {
    const { user, push, shownFlights, pauses } = await simulateDay(QUIET_SUBURB);

    expect([...shownFlights].sort()).toEqual(QUIET_SUBURB.map(({ flight }) => flight).sort());
    expect(pauses).toBe(0);
    expect(user.activity.showing).toBeUndefined();
    expect(user.activityTokens.size).toBe(0);
    expect(push.sent.filter(({ event }) => event === 'end')).toHaveLength(
      push.sent.filter(({ event }) => event === 'start').length,
    );
  });

  it('never starts more cards an hour than the limit', async () => {
    const { push } = await simulateDay(QUIET_SUBURB);
    const starts = push.sent.filter(({ event }) => event === 'start');

    expect(starts.length).toBeLessThanOrEqual(QUIET_SUBURB.length);
    expect(starts.length).toBeLessThanOrEqual(ACTIVITY_RULES.maxStartsPerHour * SIMULATED_HOURS);
  });

  it('still shows the plane when the first push hits a dropped connection', async () => {
    const push = new FakePush();
    const send = push.send.bind(push);
    let failuresLeft = 1;
    push.send = async (token, event, props) => {
      if (event === 'start' && failuresLeft > 0) {
        failuresLeft -= 1;
        return 'failed';
      }
      return send(token, event, props);
    };

    const { shownFlights, pauses } = await simulateDay(QUIET_SUBURB, push);

    expect(shownFlights).toContain('ELY001');
    expect(pauses).toBe(0);
  });
});
