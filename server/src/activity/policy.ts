import { isOnCard, type ActivityProps, type NearbyPlane, type RegisterRequest } from '@overhead/shared';

export type LiveActivityEvent = 'start' | 'update' | 'end';
export type PushResult = 'delivered' | 'token-invalid' | 'failed' | 'no-answer';

export const ACTIVITY_RULES = {
  keepAliveMs: 30_000,
  passedLingerMs: 20_000,
  circlingLimitMs: 10 * 60_000,
  forgetGoneAfterMs: 2 * 60_000,
  renewAfterMs: 20 * 60_000,
  maxStartsPerHour: 10,
  tokenWaitMs: 60_000,
  backoffMs: 15 * 60_000,
  rememberedEndedCards: 20,
} as const;

const HOUR_MS = 60 * 60_000;
const EMPTY_CARD: ActivityProps = { flight: '', route: null, stage: 'passed' };

export interface ShowingCard {
  props: ActivityProps;
  startedAt: number;
  sentAt: number;
  awaitingTokenSince?: number;
}

export interface ActivityState {
  showing?: ShowingCard;
  lastProps?: ActivityProps;
  firstSeenAt: Record<string, number>;
  lastSeenAt: Record<string, number>;
  goneSince?: number;
  recentStarts: number[];
  pausedUntil?: number;
  cardTokens: string[];
  endedTokens: string[];
}

export interface Push {
  token: string;
  event: LiveActivityEvent;
  props: ActivityProps;
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
}

export interface StepResult {
  action: Action;
  state: ActivityState;
}

export const initialActivityState = (): ActivityState => ({
  recentStarts: [],
  firstSeenAt: {},
  lastSeenAt: {},
  cardTokens: [],
  endedTokens: [],
});

export function nextStep(state: ActivityState, { planes, now, canStart }: StepInput): StepResult {
  const { showing } = state;

  if (isStartDropped(showing, state.cardTokens.length > 0, now)) {
    return {
      action: { type: 'back-off' },
      state: { ...state, showing: undefined, pausedUntil: now + ACTIVITY_RULES.backoffMs },
    };
  }

  const sightings = trackSightings(state, planes, now);
  const passing = planes.filter((plane) => !isCircling(sightings.firstSeenAt, plane, now));
  const next: ActivityState = { ...state, ...sightings };
  const [main] = passing.filter(isOnCard);
  const nextPlaneOnItsWay = passing.some((plane) => plane.stage === 'inbound');

  if (!showing) {
    if (state.cardTokens.length > 0) return endLeftoverCards(next);
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

export function pushesFor(action: Action, state: ActivityState, startToken?: string): Push[] {
  switch (action.type) {
    case 'start':
      return startToken ? [{ token: startToken, event: 'start', props: action.props }] : [];
    case 'update':
    case 'end':
      return state.cardTokens.map((token) => ({ token, event: action.type, props: action.props }));
    default:
      return [];
  }
}

export function receiveCardTokens(
  state: ActivityState,
  tokens: string[],
): { state: ActivityState; pushes: Push[] } {
  const unseen = tokens.filter(
    (token) => !state.cardTokens.includes(token) && !state.endedTokens.includes(token),
  );
  if (unseen.length === 0) return { state, pushes: [] };

  const { showing } = state;
  const cardTokens = [...state.cardTokens, ...unseen];
  if (!showing) {
    const props = state.lastProps ?? EMPTY_CARD;
    return {
      state: { ...state, cardTokens },
      pushes: unseen.map((token) => ({ token, event: 'end', props })),
    };
  }
  return {
    state: { ...state, cardTokens, showing: { ...showing, awaitingTokenSince: undefined } },
    pushes: unseen.map((token) => ({ token, event: 'update', props: showing.props })),
  };
}

export function afterPush(state: ActivityState, { token, event }: Push, result: PushResult): ActivityState {
  if (event === 'start') return result === 'delivered' || result === 'no-answer' ? state : forgetStart(state);
  if (result === 'token-invalid') return { ...state, cardTokens: without(state.cardTokens, token) };
  if (event === 'end' && result === 'delivered') {
    return {
      ...state,
      cardTokens: without(state.cardTokens, token),
      endedTokens: [...state.endedTokens, token].slice(-ACTIVITY_RULES.rememberedEndedCards),
    };
  }
  return state;
}

function forgetStart(state: ActivityState): ActivityState {
  return { ...state, showing: undefined };
}

function endLeftoverCards(state: ActivityState): StepResult {
  return { action: { type: 'end', props: state.lastProps ?? EMPTY_CARD }, state };
}

function without(tokens: string[], token: string): string[] {
  return tokens.filter((candidate) => candidate !== token);
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

function isStartDropped(showing: ShowingCard | undefined, hasCardToken: boolean, now: number): boolean {
  return (
    showing?.awaitingTokenSince !== undefined &&
    !hasCardToken &&
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

function trackSightings(
  { firstSeenAt, lastSeenAt }: Pick<ActivityState, 'firstSeenAt' | 'lastSeenAt'>,
  planes: NearbyPlane[],
  now: number,
): Pick<ActivityState, 'firstSeenAt' | 'lastSeenAt'> {
  const recentIds = Object.keys(lastSeenAt).filter(
    (id) => now - (lastSeenAt[id] ?? 0) <= ACTIVITY_RULES.forgetGoneAfterMs,
  );
  const next = {
    firstSeenAt: Object.fromEntries(recentIds.map((id) => [id, firstSeenAt[id] ?? now])),
    lastSeenAt: Object.fromEntries(recentIds.map((id) => [id, lastSeenAt[id] ?? now])),
  };
  for (const { id } of planes) {
    next.firstSeenAt[id] ??= now;
    next.lastSeenAt[id] = now;
  }
  return next;
}

function isCircling(firstSeenAt: Record<string, number>, plane: NearbyPlane, now: number): boolean {
  return now - (firstSeenAt[plane.id] ?? now) > ACTIVITY_RULES.circlingLimitMs;
}

function sameCard(a: ActivityProps, b: ActivityProps): boolean {
  return a.flight === b.flight && a.stage === b.stage;
}

function cardProps(plane: NearbyPlane & { stage: 'approaching' | 'overhead' }): ActivityProps {
  return {
    flight: plane.flight,
    airline: plane.airline,
    aircraft: plane.aircraft,
    route: plane.route,
    stage: plane.stage,
  };
}

export function isQuietTime(
  user: Pick<RegisterRequest, 'quietHours' | 'utcOffsetMinutes'>,
  now: number,
): boolean {
  if (!user.quietHours) return false;
  const [from, to] = user.quietHours;
  const localMinute = mod(Math.floor(now / 60_000) + user.utcOffsetMinutes, 24 * 60);
  return from <= to ? localMinute >= from && localMinute < to : localMinute >= from || localMinute < to;
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
