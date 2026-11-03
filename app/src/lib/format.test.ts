import type { ActivityProps } from '@overhead/shared';
import { describe, expect, it } from 'vitest';
import {
  cardDetails,
  cardTitle,
  compassDirection,
  describeDirection,
  describeStage,
  elevationAngle,
  formatDistance,
  relativeBearing,
} from './format';

const KM_IN_NM = 1 / 1.852;

describe('where to look', () => {
  it('points 33° up for a plane at 2,600 ft, 1.2 km away', () => {
    expect(elevationAngle(2600, 1.2 * KM_IN_NM)).toBe(33);
  });

  it('points straight up for a plane right above you', () => {
    expect(elevationAngle(3000, 0)).toBe(90);
  });

  it('points low for a plane far away near the horizon', () => {
    expect(elevationAngle(1500, 2.5 * KM_IN_NM)).toBe(10);
  });

  it('turns the plane bearing into a direction relative to where the phone faces', () => {
    expect(relativeBearing(45, 0)).toBe(45);
    expect(relativeBearing(10, 350)).toBe(20);
    expect(relativeBearing(350, 10)).toBe(-20);
    expect(relativeBearing(180, 0)).toBe(-180);
  });

  it.each([
    [0, 'Straight ahead'],
    [-15, 'Straight ahead'],
    [45, 'Ahead and to the right'],
    [-45, 'Ahead and to the left'],
    [90, 'To your right'],
    [-100, 'To your left'],
    [135, 'Behind you, to the right'],
    [175, 'Behind you'],
    [-180, 'Behind you'],
  ])('says %i° is "%s"', (relativeDeg, phrase) => {
    expect(describeDirection(relativeDeg)).toBe(phrase);
  });

  it.each([
    [0, 'North'],
    [44, 'Northeast'],
    [90, 'East'],
    [200, 'South'],
    [350, 'North'],
    [359.9, 'North'],
  ])('names a bearing of %f° as %s', (bearingDeg, name) => {
    expect(compassDirection(bearingDeg)).toBe(name);
  });
});

describe('what the card says', () => {
  const card: ActivityProps = {
    flight: 'ISR053',
    airline: 'Israir',
    aircraft: 'A320',
    route: { from: 'TLV', fromCity: 'Tel Aviv', to: 'ETM', toCity: 'Eilat' },
    stage: 'approaching',
  };

  it.each([
    ['approaching', 'Approaching'],
    ['overhead', 'In sight'],
    ['passed', 'Passed'],
  ] as const)('says %s as "%s"', (stage, words) => {
    expect(describeStage(stage)).toBe(words);
  });

  it('titles the card with the two cities', () => {
    expect(cardTitle(card)).toBe('Tel Aviv → Eilat');
  });

  it('says the route is unknown when it is', () => {
    expect(cardTitle({ ...card, route: null })).toBe('Route unknown');
  });

  it('names the airline and the aircraft', () => {
    expect(cardDetails(card)).toBe('Israir · A320');
  });

  it('falls back to the callsign when the airline is unknown', () => {
    expect(cardDetails({ ...card, airline: undefined, aircraft: 'C25A', flight: '4XCDO' })).toBe(
      '4XCDO · C25A',
    );
  });
});

describe('numbers on the app screen', () => {
  it('shows distance in kilometres', () => {
    expect(formatDistance(0.5)).toBe('0.9 km');
  });
});
