import type { ActivityProps, CardStage, NearbyPlane } from '@overhead/shared';

export const ACTIVITY_RULES = {
  keepAliveMs: 30_000,
  passedLingerMs: 20_000,
  circlingLimitMs: 10 * 60_000,
  renewAfterMs: 20 * 60_000,
  maxStartsPerHour: 10,
  tokenWaitMs: 60_000,
  backoffMs: 15 * 60_000,
} as const;

const HOUR_MS = 60 * 60_000;

type CardPlane = NearbyPlane & { stage: Exclude<CardStage, 'passed'> };

export interface ShowingCard {
  props: ActivityProps;
  startedAt: number;
  sentAt: number;
  awaitingTokenSince?: number;
}

export interface ActivityState {
  showing?: ShowingCard;
  lastProps?: ActivityProps;
  overheadSince: Record<string, number>;
  goneSince?: number;
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
  planes: NearbyPlane[];
  now: number;
  canStart: boolean;
  hasActivityToken: boolean;
}

export interface StepResult {
  action: Action;
  state: ActivityState;
}

export const initialActivityState = (): ActivityState => ({ recentStarts: [], overheadSince: {} });

export function nextStep(
  state: ActivityState,
  { planes, now, canStart, hasActivityToken }: StepInput,
): StepResult {
  const { showing } = state;

  if (isStartDropped(showing, hasActivityToken, now)) {
    return {
      action: { type: 'back-off' },
      state: { ...state, showing: undefined, pausedUntil: now + ACTIVITY_RULES.backoffMs },
    };
  }

  const overheadSince = trackOverhead(state.overheadSince, planes, now);
  const passing = planes.filter((plane) => !isCircling(overheadSince, plane, now));
  const next: ActivityState = { ...state, overheadSince };
  const [main] = passing.filter(isOnCard);
  const nextPlaneOnItsWay = passing.some((plane) => plane.stage === 'inbound');

  if (!showing) {
    if (!main || !canStart || !mayStart(state, now)) return none(next);
    return start(next, cardProps(main), now);
  }

  const onlyCircling = planes.length > 0 && passing.length === 0;
  const tooOld = now - showing.startedAt > ACTIVITY_RULES.renewAfterMs;
  if (onlyCircling || tooOld) return end(next, showing);
  if (!main) return wrapUp(next, showing, now, nextPlaneOnItsWay);

  const props = cardProps(main);
  const inSight = { ...next, goneSince: undefined };
  const unchanged = sameCard(props, showing.props);
  if (unchanged && now - showing.sentAt < ACTIVITY_RULES.keepAliveMs) return none(inSight);
  return update(inSight, showing, props, now);
}

export function acknowledgeActivityToken(state: ActivityState): ActivityState {
  if (!state.showing) return state;
  return { ...state, showing: { ...state.showing, awaitingTokenSince: undefined } };
}

function wrapUp(
  state: ActivityState,
  showing: ShowingCard,
  now: number,
  nextPlaneOnItsWay: boolean,
): StepResult {
  const goneSince = state.goneSince ?? now;
  const lingerOver = now - goneSince >= ACTIVITY_RULES.passedLingerMs;
  const holdForNextPlane = nextPlaneOnItsWay && showing.props.stage !== 'approaching';
  if (lingerOver && !holdForNextPlane) return end(state, showing);
  if (showing.props.stage === 'overhead') {
    return update({ ...state, goneSince }, showing, { ...showing.props, stage: 'passed' }, now);
  }
  return none({ ...state, goneSince });
}

function start(state: ActivityState, props: ActivityProps, now: number): StepResult {
  return {
    action: { type: 'start', props },
    state: {
      ...state,
      goneSince: undefined,
      showing: { props, startedAt: now, sentAt: now, awaitingTokenSince: now },
      lastProps: props,
      recentStarts: [...startsWithinHour(state.recentStarts, now), now],
    },
  };
}

function update(state: ActivityState, showing: ShowingCard, props: ActivityProps, now: number): StepResult {
  return {
    action: { type: 'update', props },
    state: { ...state, showing: { ...showing, props, sentAt: now }, lastProps: props },
  };
}

function end(state: ActivityState, showing: ShowingCard): StepResult {
  return {
    action: { type: 'end', props: showing.props },
    state: { ...state, showing: undefined, goneSince: undefined },
  };
}

function none(state: ActivityState): StepResult {
  return { action: { type: 'none' }, state };
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

function trackOverhead(
  previous: Record<string, number>,
  planes: NearbyPlane[],
  now: number,
): Record<string, number> {
  return Object.fromEntries(planes.map(({ flight }) => [flight, previous[flight] ?? now]));
}

function isOnCard(plane: NearbyPlane): plane is CardPlane {
  return plane.stage !== 'inbound';
}

function isCircling(overheadSince: Record<string, number>, plane: NearbyPlane, now: number): boolean {
  return now - (overheadSince[plane.flight] ?? now) > ACTIVITY_RULES.circlingLimitMs;
}

function sameCard(a: ActivityProps, b: ActivityProps): boolean {
  return a.flight === b.flight && a.stage === b.stage;
}

function cardProps(plane: CardPlane): ActivityProps {
  return {
    flight: plane.flight,
    airline: plane.airline,
    aircraft: plane.aircraft,
    route: plane.route,
    stage: plane.stage,
  };
}
