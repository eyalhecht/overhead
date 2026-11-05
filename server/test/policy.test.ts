import type { NearbyPlane, PassStage } from '@overhead/shared';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_RULES,
  afterPush,
  initialActivityState,
  nextStep,
  pushesFor,
  receiveCardTokens,
  type Action,
  type ActivityState,
} from '../src/activity/policy.js';
import { nearbyPlane } from './fakes.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const plane = (flight: string, stage: PassStage = 'overhead') => nearbyPlane(flight, { stage });

class Simulation {
  state: ActivityState = initialActivityState();
  now = 0;
  canStart = true;
  lastAction: Action = { type: 'none' };

  step(planes: NearbyPlane[], afterMs = 5 * SECOND) {
    this.now += afterMs;
    const { action, state } = nextStep(this.state, {
      planes,
      now: this.now,
      canStart: this.canStart,
    });
    this.state = state;
    this.lastAction = action;
    if (action.type === 'end') {
      for (const push of pushesFor(action, state)) this.state = afterPush(this.state, push, 'delivered');
    }
    return action.type;
  }

  shownStage() {
    return 'props' in this.lastAction ? this.lastAction.props.stage : undefined;
  }

  confirmCard(token = 'card-1') {
    this.state = receiveCardTokens(this.state, [token]).state;
  }
}

describe('nextStep', () => {
  it('does nothing while the sky is empty', () => {
    expect(new Simulation().step([])).toBe('none');
  });

  it('starts a card as Approaching, then updates it when the plane is above you', () => {
    const sim = new Simulation();
    expect(sim.step([plane('BAW1', 'approaching')])).toBe('start');
    expect(sim.shownStage()).toBe('approaching');
    sim.confirmCard();

    expect(sim.step([plane('BAW1', 'overhead')])).toBe('update');
    expect(sim.shownStage()).toBe('overhead');
  });

  it('sends nothing while the card is unchanged, except a quiet refresh every 30 seconds', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();

    expect(sim.step([plane('BAW1')], 25 * SECOND)).toBe('none');
    expect(sim.step([plane('BAW1')], 6 * SECOND)).toBe('update');
  });

  it('shows Passed for 20 seconds after the plane has gone, then ends the card', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();

    expect(sim.step([])).toBe('update');
    expect(sim.shownStage()).toBe('passed');
    expect(sim.step([], ACTIVITY_RULES.passedLingerMs - 5 * SECOND)).toBe('none');
    expect(sim.step([], 5 * SECOND)).toBe('end');
  });

  it('ends quietly, without Passed, when an approaching plane turns away', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1', 'approaching')]);
    sim.confirmCard();

    expect(sim.step([])).toBe('none');
    expect(sim.step([], ACTIVITY_RULES.passedLingerMs)).toBe('end');
    expect(sim.shownStage()).toBe('approaching');
  });

  it('keeps the card through a few seconds of missing data', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();

    sim.step([]);
    expect(sim.step([plane('BAW1')])).toBe('update');
    expect(sim.shownStage()).toBe('overhead');
    expect(sim.step([], ACTIVITY_RULES.passedLingerMs - SECOND)).toBe('update');
  });

  it('keeps a Passed card open while the next plane is on its way, then switches to it', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();
    sim.step([plane('DLH2', 'inbound')]);

    expect(sim.shownStage()).toBe('passed');
    expect(sim.step([plane('DLH2', 'inbound')], ACTIVITY_RULES.passedLingerMs + 10 * SECOND)).toBe('none');
    expect(sim.step([plane('DLH2', 'approaching')])).toBe('update');
    expect(sim.lastAction).toMatchObject({ props: { flight: 'DLH2', stage: 'approaching' } });
  });

  it('never starts a card for a plane that is only inbound', () => {
    expect(new Simulation().step([plane('DLH2', 'inbound')])).toBe('none');
  });

  it('switches the same card to the next plane', () => {
    const sim = new Simulation();
    expect(sim.step([plane('BAW1')])).toBe('start');
    sim.confirmCard();
    sim.step([]);

    expect(sim.step([plane('DLH2', 'approaching')])).toBe('update');
    expect(sim.lastAction).toMatchObject({ props: { flight: 'DLH2', stage: 'approaching' } });
  });

  it('puts the plane above you on the card before one still approaching', () => {
    const { action } = nextStep(initialActivityState(), {
      planes: [plane('BAW1', 'overhead'), plane('DLH2', 'approaching')],
      now: MINUTE,
      canStart: true,
    });
    expect(action).toMatchObject({ type: 'start', props: { flight: 'BAW1' } });
  });

  it('carries the route, airline and aircraft on the card', () => {
    const { action } = nextStep(initialActivityState(), {
      planes: [nearbyPlane('ISR053', { airline: 'Israir', aircraft: 'A320' })],
      now: MINUTE,
      canStart: true,
    });
    expect(action).toMatchObject({
      type: 'start',
      props: {
        flight: 'ISR053',
        airline: 'Israir',
        aircraft: 'A320',
        route: { from: 'LHR' },
        stage: 'overhead',
      },
    });
  });

  it('shows a plane whose route is unknown', () => {
    const sim = new Simulation();
    expect(sim.step([nearbyPlane('4XCDO', { route: null })])).toBe('start');
    expect(sim.lastAction).toMatchObject({ props: { flight: '4XCDO', route: null } });
  });

  it('opens at most 10 new cards per hour', () => {
    const sim = new Simulation();
    const starts = Array.from({ length: 11 }, (_, index) => {
      const action = sim.step([plane(`FLT${index}`)]);
      sim.confirmCard();
      sim.step([]);
      sim.step([], ACTIVITY_RULES.passedLingerMs);
      return action;
    });
    expect(starts).toEqual([...Array(10).fill('start'), 'none']);
  });

  it('backs off when the phone never confirms the card, and pauses new cards', () => {
    const sim = new Simulation();
    expect(sim.step([plane('BAW1')])).toBe('start');
    expect(sim.step([plane('BAW1')], ACTIVITY_RULES.tokenWaitMs + SECOND)).toBe('back-off');
    expect(sim.step([plane('BAW1')], MINUTE)).toBe('none');
    expect(sim.step([plane('BAW2')], ACTIVITY_RULES.backoffMs)).toBe('start');
  });

  it('never starts a card when Live Activities are switched off', () => {
    const sim = new Simulation();
    sim.canStart = false;
    expect(sim.step([plane('BAW1')])).toBe('none');
  });

  it('drops an aircraft that keeps circling over you, and does not show it again', () => {
    const sim = new Simulation();
    sim.step([plane('HELI1')]);
    sim.confirmCard();
    expect(sim.step([plane('HELI1')], ACTIVITY_RULES.circlingLimitMs + SECOND)).toBe('end');
    expect(sim.step([plane('HELI1')])).toBe('none');
    expect(sim.step([plane('BAW2')])).toBe('start');
  });

  it('renews a long-running card so it never outlives the app fallback', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();
    expect(sim.step([plane('AFR2')], 9 * MINUTE)).toBe('update');
    expect(sim.step([plane('KLM3')], 9 * MINUTE)).toBe('update');
    expect(sim.step([plane('BAW9')], 5 * MINUTE)).toBe('end');
    expect(sim.step([plane('BAW9')])).toBe('start');
  });
});

describe('card tokens', () => {
  it('updates a card token that arrives while the card is showing, right away', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    const { pushes } = receiveCardTokens(sim.state, ['card-1']);
    expect(pushes).toEqual([
      { token: 'card-1', event: 'update', props: expect.objectContaining({ flight: 'BAW1' }) },
    ]);
  });

  it('ends a card whose token arrives after the plane has gone', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.state = afterPush(
      sim.state,
      { token: 'start', event: 'start', props: sim.state.lastProps! },
      'delivered',
    );
    sim.state = { ...sim.state, showing: undefined };
    const { pushes } = receiveCardTokens(sim.state, ['late-card']);
    expect(pushes).toMatchObject([{ token: 'late-card', event: 'end', props: { flight: 'BAW1' } }]);
  });

  it('keeps trying to end a card until Apple takes the end', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();
    const end = { token: 'card-1', event: 'end' as const, props: sim.state.lastProps! };
    sim.state = { ...sim.state, showing: undefined };

    sim.state = afterPush(sim.state, end, 'failed');
    expect(nextStep(sim.state, { planes: [], now: sim.now, canStart: true }).action.type).toBe('end');
    sim.state = afterPush(sim.state, end, 'delivered');
    expect(nextStep(sim.state, { planes: [], now: sim.now, canStart: true }).action.type).toBe('none');
  });

  it('never takes a card token back once its card has ended', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();
    sim.state = afterPush(
      sim.state,
      { token: 'card-1', event: 'end', props: sim.state.lastProps! },
      'delivered',
    );
    expect(receiveCardTokens(sim.state, ['card-1']).pushes).toEqual([]);
  });

  it('remembers only the last few ended cards', () => {
    let state = initialActivityState();
    for (let card = 0; card < ACTIVITY_RULES.rememberedEndedCards + 5; card += 1) {
      state = receiveCardTokens(state, [`card-${card}`]).state;
      state = afterPush(
        state,
        { token: `card-${card}`, event: 'end', props: { flight: 'X', route: null, stage: 'passed' } },
        'delivered',
      );
    }
    expect(state.endedTokens).toHaveLength(ACTIVITY_RULES.rememberedEndedCards);
    expect(state.cardTokens).toEqual([]);
  });

  it('drops a card token Apple reports as invalid', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();
    sim.state = afterPush(
      sim.state,
      { token: 'card-1', event: 'update', props: sim.state.lastProps! },
      'token-invalid',
    );
    expect(sim.state.cardTokens).toEqual([]);
  });

  it('takes back a start that Apple did not accept, so it does not count', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.state = afterPush(
      sim.state,
      { token: 'start', event: 'start', props: sim.state.lastProps! },
      'failed',
    );
    expect(sim.state.showing).toBeUndefined();
    expect(sim.state.recentStarts).toEqual([]);
  });
});
