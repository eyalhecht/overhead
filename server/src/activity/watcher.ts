import type { ActivityProps, GeoPoint, NearbyPlane } from '@overhead/shared';
import type { Sky } from '../flights/sky.js';
import type { LiveActivityEvent, PushClient } from '../push/apns.js';
import { isQuietTime, userLabel, type User, type UserStore } from '../users.js';
import { acknowledgeActivityToken, nextStep, type Action } from './policy.js';

const TICK_INTERVAL_MS = 5000;
const EMPTY_CARD: ActivityProps = { flight: '', route: null, stage: 'passed' };

export interface WatcherDependencies {
  users: UserStore;
  sky: Sky;
  push: PushClient;
  now?: () => number;
  demoLocation?: GeoPoint;
}

export interface Watcher {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
  reportActivityTokens(user: User, tokens: string[]): Promise<void>;
}

export function createWatcher({
  users,
  sky,
  push,
  now = Date.now,
  demoLocation,
}: WatcherDependencies): Watcher {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  async function tick(): Promise<void> {
    for (const user of users.all()) {
      try {
        await watch(user);
      } catch (error) {
        console.warn(`${userLabel(user)} watch failed: ${(error as Error).message}`);
      }
    }
  }

  async function watch(user: User): Promise<void> {
    const planes = isQuietTime(user, now()) ? [] : await planesAbove(user, demoLocation ?? user.location);
    const previous = user.activity;
    const { action, state } = nextStep(previous, {
      planes,
      now: now(),
      canStart: user.startToken !== undefined,
      hasActivityToken: user.activityTokens.size > 0,
    });
    user.activity = state;
    logChange(user, previous.showing?.props, action);
    if (action.type === 'start') {
      if (!(await startCard(user, action.props))) user.activity = previous;
      return;
    }
    await perform(user, action);
  }

  async function startCard(user: User, props: ActivityProps): Promise<boolean> {
    if (!user.startToken) return false;
    const result = await push.send(user.startToken, 'start', props);
    if (result === 'token-invalid') user.startToken = undefined;
    if (result === 'delivered')
      console.log(`${userLabel(user)} card started: ${props.flight} ${props.stage}`);
    return result === 'delivered';
  }

  function logChange(user: User, before: ActivityProps | undefined, action: Action): void {
    if (action.type === 'end') console.log(`${userLabel(user)} card ended: ${action.props.flight}`);
    if (action.type !== 'update' || !before) return;
    if (before.flight !== action.props.flight || before.stage !== action.props.stage)
      console.log(`${userLabel(user)} card now: ${action.props.flight} ${action.props.stage}`);
  }

  function planesAbove(user: User, point: GeoPoint): Promise<NearbyPlane[]> {
    return sky.planesAbove(point).catch((error: Error): NearbyPlane[] => {
      console.warn(`${userLabel(user)} cannot see the sky: ${error.message}`);
      return [];
    });
  }

  async function perform(user: User, action: Exclude<Action, { type: 'start' }>): Promise<void> {
    switch (action.type) {
      case 'update':
        return sendToActivities(user, 'update', action.props, [...user.activityTokens]);
      case 'end':
        return sendToActivities(user, 'end', action.props, [...user.activityTokens]);
      case 'back-off':
        console.warn(`${userLabel(user)} card never confirmed, pausing new cards`);
        return;
      case 'none':
        return;
    }
  }

  async function sendToActivities(
    user: User,
    event: LiveActivityEvent,
    props: ActivityProps,
    tokens: string[],
  ): Promise<void> {
    for (const token of tokens) {
      const result = await push.send(token, event, props);
      if (event === 'end' || result === 'token-invalid') user.activityTokens.delete(token);
      if (event === 'end') user.endedTokens.add(token);
    }
  }

  async function reportActivityTokens(user: User, tokens: string[]): Promise<void> {
    const unseen = tokens.filter((token) => !user.activityTokens.has(token) && !user.endedTokens.has(token));
    if (unseen.length === 0) return;

    if (user.activity.showing) {
      unseen.forEach((token) => user.activityTokens.add(token));
      user.activity = acknowledgeActivityToken(user.activity);
      return;
    }
    await sendToActivities(user, 'end', user.activity.lastProps ?? EMPTY_CARD, unseen);
  }

  function schedule(): void {
    timer = setTimeout(async () => {
      await tick();
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
    },
    tick,
    reportActivityTokens,
  };
}
