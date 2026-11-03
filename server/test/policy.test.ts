import type { NearbyPlane, PassStage } from '@overhead/shared';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_RULES,
  acknowledgeActivityToken,
  initialActivityState,
  nextStep,
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
  hasToken = false;
  lastAction: Action = { type: 'none' };

  step(planes: NearbyPlane[], afterMs = 5 * SECOND) {
    this.now += afterMs;
    const { action, state } = nextStep(this.state, {
      planes,
      now: this.now,
      canStart: this.canStart,
      hasActivityToken: this.hasToken,
    });
    this.state = state;
    this.lastAction = action;
    return action.type;
  }

  shownStage() {
    return 'props' in this.lastAction ? this.lastAction.props.stage : undefined;
  }

  confirmCard() {
    this.hasToken = true;
    this.state = acknowledgeActivityToken(this.state);
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
      hasActivityToken: false,
    });
    expect(action).toMatchObject({ type: 'start', props: { flight: 'BAW1' } });
  });

  it('carries the route, airline and aircraft on the card', () => {
    const { action } = nextStep(initialActivityState(), {
      planes: [nearbyPlane('ISR053', { airline: 'Israir', aircraft: 'A320' })],
      now: MINUTE,
      canStart: true,
      hasActivityToken: false,
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
