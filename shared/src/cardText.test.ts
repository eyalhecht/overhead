import { describe, expect, it } from 'vitest';
import { cardText } from './cardText.js';
import type { ActivityProps } from './index.js';

const card: ActivityProps = {
  flight: 'ISR053',
  airline: 'Israir',
  aircraft: 'A320',
  route: { from: 'TLV', fromCity: 'Tel Aviv', to: 'ETM', toCity: 'Eilat' },
  stage: 'approaching',
};

describe('cardText', () => {
  it.each([
    ['approaching', 'Approaching'],
    ['overhead', 'Above you now'],
    ['passed', 'Passed'],
  ] as const)('says "%s" as "%s"', (stage, status) => {
    expect(cardText({ ...card, stage }).status).toBe(status);
  });

  it('names the route by city', () => {
    expect(cardText(card).title).toBe('Tel Aviv → Eilat');
  });

  it('says so when the route is unknown', () => {
    expect(cardText({ ...card, route: null }).title).toBe('Route unknown');
  });

  it('shows the airline and aircraft', () => {
    expect(cardText(card).details).toBe('Israir · A320');
  });

  it('falls back to the flight number when the airline is unknown', () => {
    expect(cardText({ ...card, airline: undefined, aircraft: 'C25A', flight: '4XCDO' }).details).toBe(
      '4XCDO · C25A',
    );
  });
});
