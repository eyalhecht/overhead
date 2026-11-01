import type { RoutedPlane } from '@overhead/shared';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_RULES,
  acknowledgeActivityToken,
  initialActivityState,
  nextStep,
  type ActivityState,
} from '../src/activity/policy.js';
import { routedPlane } from './fakes.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const plane = (flight: string, secondsLeft = 60) => routedPlane(flight, { secondsLeft });

class Simulation {
  state: ActivityState = initialActivityState();
  now = 0;
  canStart = true;
  hasToken = false;

  step(planes: RoutedPlane[], afterMs = 5 * SECOND) {
    this.now += afterMs;
    const { action, state } = nextStep(this.state, {
      planes,
      now: this.now,
      canStart: this.canStart,
      hasActivityToken: this.hasToken,
    });
    this.state = state;
    return action.type;
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

  it('starts a card when a plane arrives, then refreshes it every 15 seconds', () => {
    const sim = new Simulation();
    expect(sim.step([plane('BAW1')])).toBe('start');
    sim.confirmCard();
    expect(sim.step([plane('BAW1')], 10 * SECOND)).toBe('none');
    expect(sim.step([plane('BAW1')], 6 * SECOND)).toBe('update');
  });

  it('updates at once when a second plane joins or the main plane changes', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();
    expect(sim.step([plane('BAW1'), plane('DLH2')])).toBe('update');
    expect(sim.step([plane('DLH2')])).toBe('update');
  });

  it('keeps the card for the grace period after the sky empties, then ends it', () => {
    const sim = new Simulation();
    sim.step([plane('BAW1')]);
    sim.confirmCard();
    expect(sim.step([])).toBe('none');
    expect(sim.step([], ACTIVITY_RULES.gracePeriodMs - 10 * SECOND)).toBe('none');
    expect(sim.step([], 10 * SECOND)).toBe('end');
  });

  it('puts a stream of planes on one card (busy sky)', () => {
    const sim = new Simulation();
    const actions = ['BAW1', 'AFR2', 'KLM3', 'SWR4'].flatMap((flight) => {
      const arrived = sim.step([plane(flight)]);
      sim.confirmCard();
      const gap = sim.step([], 60 * SECOND);
      return [arrived, gap];
    });
    expect(actions.filter((type) => type === 'start')).toHaveLength(1);
    expect(actions).not.toContain('end');
  });

  it('opens at most 5 new cards per hour', () => {
    const sim = new Simulation();
    const starts = Array.from({ length: 6 }, (_, index) => {
      const action = sim.step([plane(`FLT${index}`)]);
      sim.confirmCard();
      sim.step([]);
      sim.step([], ACTIVITY_RULES.gracePeriodMs);
      return action;
    });
    expect(starts).toEqual(['start', 'start', 'start', 'start', 'start', 'none']);
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

  it('ends a card when the same aircraft hovers too long, and does not reshow it', () => {
    const sim = new Simulation();
    sim.step([plane('HELI1')]);
    sim.confirmCard();
    expect(sim.step([plane('HELI1')], ACTIVITY_RULES.hoverLimitMs + SECOND)).toBe('end');
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

  it('counts down to when the plane leaves', () => {
    const { action } = nextStep(initialActivityState(), {
      planes: [plane('BAW1', 45)],
      now: 1_000_000,
      canStart: true,
      hasActivityToken: false,
    });
    expect(action).toMatchObject({ type: 'start', props: { flight: 'BAW1', endsAt: 1_045_000 } });
  });
});
