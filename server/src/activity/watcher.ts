import type { GeoPoint, NearbyPlane } from '@overhead/shared';
import type { Sky } from '../flights/sky.js';
import type { PushClient } from '../push/apns.js';
import { userLabel, type User, type UserStore } from '../users.js';
import { afterPush, isQuietTime, nextStep, pushesFor, receiveCardTokens, type Push } from './policy.js';

const TICK_INTERVAL_MS = 5000;
const MAX_PHONES_AT_ONCE = 8;
const APP_OPEN_FOR_MS = 60_000;
const HEALTH_EVERY_MS = 60_000;

export interface WatcherDependencies {
  users: UserStore;
  sky: Sky;
  push: PushClient;
  now?: () => number;
  demoLocation?: GeoPoint;
  demoDevice?: string;
}

export interface Watcher {
  start(): void;
  stop(): Promise<void>;
  tick(): Promise<void>;
  reportCardTokens(user: User, tokens: string[]): Promise<void>;
  planesFor(user: User): NearbyPlane[];
  appOpened(user: User): void;
  forget(user: User): Promise<void>;
}

export function createWatcher({
  users,
  sky,
  push: pushClient,
  now = Date.now,
  demoLocation,
  demoDevice,
}: WatcherDependencies): Watcher {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let currentTick: Promise<void> = Promise.resolve();
  const planesSeen = new WeakMap<User, NearbyPlane[]>();
  const appOpenAt = new WeakMap<User, number>();
  const ticks = { count: 0, totalMs: 0, maxMs: 0, phones: 0, since: now() };

  async function tick(): Promise<void> {
    const startedAt = now();
    const waiting = users.all().filter(canGetCard);
    const phones = waiting.length;
    await sky.refresh(waiting.filter((user) => !isQuietTime(user, now())).map(spotOf));
    const lane = async () => {
      for (let user = waiting.shift(); user; user = waiting.shift()) await watchSafely(user);
    };
    await Promise.all(Array.from({ length: Math.min(MAX_PHONES_AT_ONCE, waiting.length) }, lane));
    reportHealth(now() - startedAt, phones);
  }

  // A phone without a start token can only see a card it already has, or the sky while the app is open.
  function canGetCard(user: User): boolean {
    const appOpen = now() - (appOpenAt.get(user) ?? -Infinity) < APP_OPEN_FOR_MS;
    return user.startToken !== undefined || user.activity.showing !== undefined || appOpen;
  }

  function reportHealth(tookMs: number, phones: number): void {
    ticks.count += 1;
    ticks.totalMs += tookMs;
    ticks.maxMs = Math.max(ticks.maxMs, tookMs);
    ticks.phones = Math.max(ticks.phones, phones);
    if (now() - ticks.since < HEALTH_EVERY_MS) return;
    const averageMs = Math.round(ticks.totalMs / ticks.count);
    console.log(
      `Health: ${ticks.phones} phones watched, tick ${averageMs} ms on average, ${ticks.maxMs} ms at most`,
    );
    Object.assign(ticks, { count: 0, totalMs: 0, maxMs: 0, phones: 0, since: now() });
  }

  async function watchSafely(user: User): Promise<void> {
    try {
      await watch(user);
    } catch (error) {
      console.warn(`${userLabel(user)} watch failed: ${(error as Error).message}`);
    }
  }

  async function watch(user: User): Promise<void> {
    const planes = isQuietTime(user, now()) ? [] : planesAbove(user, spotOf(user));
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

  function spotOf(user: User): GeoPoint {
    const moved = demoLocation && (!demoDevice || user.deviceId.startsWith(demoDevice));
    return moved ? demoLocation : user.location;
  }

  function planesAbove(user: User, point: GeoPoint): NearbyPlane[] {
    try {
      return sky.planesAbove(point);
    } catch (error) {
      console.warn(`${userLabel(user)} cannot see the sky: ${(error as Error).message}`);
      return [];
    }
  }

  // Deleting a phone's data ends any card still on its Lock Screen first, then removes the phone.
  async function forget(user: User): Promise<void> {
    const props = user.activity.showing?.props ?? user.activity.lastProps;
    if (props)
      await send(
        user,
        user.activity.cardTokens.map((token) => ({ token, event: 'end', props })),
      );
    users.remove(user.deviceId);
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
    appOpened: (user) => appOpenAt.set(user, now()),
    forget,
  };
}
