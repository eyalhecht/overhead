import type { GeoPoint, NearbyPlane } from '@overhead/shared';
import type { Sky } from '../flights/sky.js';
import type { PushClient } from '../push/apns.js';
import { userLabel, type User, type UserStore } from '../users.js';
import { afterPush, isQuietTime, nextStep, pushesFor, receiveCardTokens, type Push } from './policy.js';

const TICK_INTERVAL_MS = 5000;
const MAX_PHONES_AT_ONCE = 8;

export interface WatcherDependencies {
  users: UserStore;
  sky: Sky;
  push: PushClient;
  now?: () => number;
  demoLocation?: GeoPoint;
}

export interface Watcher {
  start(): void;
  stop(): Promise<void>;
  tick(): Promise<void>;
  reportCardTokens(user: User, tokens: string[]): Promise<void>;
  planesFor(user: User): NearbyPlane[];
}

export function createWatcher({
  users,
  sky,
  push: pushClient,
  now = Date.now,
  demoLocation,
}: WatcherDependencies): Watcher {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let currentTick: Promise<void> = Promise.resolve();
  const planesSeen = new WeakMap<User, NearbyPlane[]>();

  async function tick(): Promise<void> {
    const waiting = users.all();
    const lane = async () => {
      for (let user = waiting.shift(); user; user = waiting.shift()) await watchSafely(user);
    };
    await Promise.all(Array.from({ length: Math.min(MAX_PHONES_AT_ONCE, waiting.length) }, lane));
  }

  async function watchSafely(user: User): Promise<void> {
    try {
      await watch(user);
    } catch (error) {
      console.warn(`${userLabel(user)} watch failed: ${(error as Error).message}`);
    }
  }

  async function watch(user: User): Promise<void> {
    const planes = isQuietTime(user, now()) ? [] : await planesAbove(user, demoLocation ?? user.location);
    planesSeen.set(user, planes);
    const { action, state } = nextStep(user.activity, {
      planes,
      now: now(),
      canStart: user.startToken !== undefined,
    });
    user.activity = state;
    if (action.type === 'back-off')
      console.warn(`${userLabel(user)} card never confirmed, pausing new cards`);
    await send(user, pushesFor(action, state, user.startToken));
    users.save(user);
  }

  async function send(user: User, pushes: Push[]): Promise<void> {
    const answered = await Promise.all(
      pushes.map(async (push) => ({
        push,
        result: await pushClient.send(push.token, push.event, push.props),
      })),
    );
    for (const { push, result } of answered) {
      user.activity = afterPush(user.activity, push, result);
      if (push.event === 'start' && result === 'token-invalid' && user.startToken === push.token) {
        user.startToken = undefined;
      }
      if (push.event === 'start' && result === 'delivered') {
        const heardDb = planesSeen.get(user)?.find((plane) => plane.flight === push.props.flight)?.heardDb;
        const reason = heardDb === undefined ? 'passing close' : `heard at about ${heardDb} dB`;
        console.log(`${userLabel(user)} card started: ${push.props.flight} ${push.props.stage}, ${reason}`);
      }
    }
  }

  function planesAbove(user: User, point: GeoPoint): Promise<NearbyPlane[]> {
    return sky.planesAbove(point).catch((error: Error): NearbyPlane[] => {
      console.warn(`${userLabel(user)} cannot see the sky: ${error.message}`);
      return [];
    });
  }

  async function reportCardTokens(user: User, tokens: string[]): Promise<void> {
    const { state, pushes } = receiveCardTokens(user.activity, tokens);
    user.activity = state;
    await send(user, pushes);
    users.save(user);
  }

  function schedule(): void {
    timer = setTimeout(async () => {
      currentTick = tick();
      await currentTick;
      if (running) schedule();
    }, TICK_INTERVAL_MS);
  }

  return {
    start() {
      running = true;
      schedule();
    },
    stop() {
      running = false;
      clearTimeout(timer);
      return currentTick;
    },
    tick,
    reportCardTokens,
    planesFor: (user) => planesSeen.get(user) ?? [],
  };
}
