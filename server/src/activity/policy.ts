import type { ActivityProps, NearbyPlane, Route } from '@overhead/shared';

export const ACTIVITY_RULES = {
  refreshIntervalMs: 15_000,
  gracePeriodMs: 90_000,
  hoverLimitMs: 10 * 60_000,
  renewAfterMs: 20 * 60_000,
  maxStartsPerHour: 5,
  tokenWaitMs: 60_000,
  backoffMs: 15 * 60_000,
} as const;

const HOUR_MS = 60 * 60_000;

export type RoutedPlane = NearbyPlane & { route: Route };

export interface ShowingCard {
  key: string;
  props: ActivityProps;
  startedAt: number;
  sentAt: number;
  awaitingTokenSince?: number;
}

export interface ActivityState {
  showing?: ShowingCard;
  lastProps?: ActivityProps;
  main?: { flight: string; since: number };
  emptySince?: number;
  blockedKey?: string;
  recentStarts: number[];
  pausedUntil?: number;
}

export type Action =
  | { type: 'none' }
  | { type: 'start'; props: ActivityProps }
  | { type: 'update'; props: ActivityProps }
  | { type: 'end'; props: ActivityProps }
  | { type: 'back-off' };

export interface StepInput {
  planes: RoutedPlane[];
  now: number;
  canStart: boolean;
  hasActivityToken: boolean;
}

export interface StepResult {
  action: Action;
  state: ActivityState;
}

export const initialActivityState = (): ActivityState => ({ recentStarts: [] });

export function nextStep(
  state: ActivityState,
  { planes, now, canStart, hasActivityToken }: StepInput,
): StepResult {
  const { showing } = state;

  if (isStartDropped(showing, hasActivityToken, now)) {
    return {
      action: { type: 'back-off' },
      state: { ...state, showing: undefined, main: undefined, pausedUntil: now + ACTIVITY_RULES.backoffMs },
    };
  }

  const [main, second] = planes;
  const key = main ? cardKey(main, second) : undefined;
  const next: ActivityState = {
    ...state,
    main: main ? trackMain(state.main, main.flight, now) : undefined,
    blockedKey: key === state.blockedKey ? state.blockedKey : undefined,
  };

  const hovering = !!showing && !!next.main && now - next.main.since > ACTIVITY_RULES.hoverLimitMs;
  const tooOld = !!showing && now - showing.startedAt > ACTIVITY_RULES.renewAfterMs;
  if (hovering) next.blockedKey = key;

  const visibleKey = hovering || tooOld || key === next.blockedKey ? undefined : key;

  if (!visibleKey) {
    if (!showing) return none(next);
    const emptySince = hovering || tooOld ? now - ACTIVITY_RULES.gracePeriodMs : (state.emptySince ?? now);
    if (now - emptySince < ACTIVITY_RULES.gracePeriodMs) return none({ ...next, emptySince });
    return {
      action: { type: 'end', props: showing.props },
      state: { ...next, showing: undefined, emptySince: undefined },
    };
  }

  next.emptySince = undefined;

  if (!showing) {
    if (!canStart || !mayStart(state, now)) return none(next);
    const props = cardProps(planes, now);
    return {
      action: { type: 'start', props },
      state: {
        ...next,
        main: { flight: props.flight, since: now },
        showing: { key: visibleKey, props, startedAt: now, sentAt: now, awaitingTokenSince: now },
        lastProps: props,
        recentStarts: [...startsWithinHour(state.recentStarts, now), now],
      },
    };
  }

  const unchanged = visibleKey === showing.key;
  if (unchanged && now - showing.sentAt < ACTIVITY_RULES.refreshIntervalMs) return none(next);

  const props = cardProps(planes, now);
  return {
    action: { type: 'update', props },
    state: { ...next, showing: { ...showing, key: visibleKey, props, sentAt: now }, lastProps: props },
  };
}

export function acknowledgeActivityToken(state: ActivityState): ActivityState {
  if (!state.showing) return state;
  return { ...state, showing: { ...state.showing, awaitingTokenSince: undefined } };
}

function isStartDropped(showing: ShowingCard | undefined, hasActivityToken: boolean, now: number): boolean {
  return (
    showing?.awaitingTokenSince !== undefined &&
    !hasActivityToken &&
    now - showing.awaitingTokenSince > ACTIVITY_RULES.tokenWaitMs
  );
}

function mayStart(state: ActivityState, now: number): boolean {
  const paused = state.pausedUntil !== undefined && now < state.pausedUntil;
  return !paused && startsWithinHour(state.recentStarts, now).length < ACTIVITY_RULES.maxStartsPerHour;
}

function startsWithinHour(starts: number[], now: number): number[] {
  return starts.filter((startedAt) => now - startedAt < HOUR_MS);
}

function trackMain(
  current: ActivityState['main'],
  flight: string,
  now: number,
): NonNullable<ActivityState['main']> {
  return current?.flight === flight ? current : { flight, since: now };
}

function cardKey(main: RoutedPlane, second: RoutedPlane | undefined): string {
  return second ? `${main.flight}|${second.flight}` : main.flight;
}

function none(state: ActivityState): StepResult {
  return { action: { type: 'none' }, state };
}

function cardProps(planes: RoutedPlane[], now: number): ActivityProps {
  const [main, second] = planes;
  if (!main) throw new Error('cardProps needs at least one plane');
  return {
    ...main.route,
    flight: main.flight,
    aircraft: main.aircraft,
    rare: main.rare,
    altitudeFt: main.altitudeFt,
    endsAt: now + main.secondsLeft * 1000,
    more: Math.max(0, planes.length - 2),
    second: second && { ...second.route, flight: second.flight, endsAt: now + second.secondsLeft * 1000 },
  };
}
