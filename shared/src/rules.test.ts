import { describe, expect, it } from 'vitest';
import { clockTime, isOnCard, QUIET_HOURS, roughLocation } from './rules.js';

describe('shared rules', () => {
  it('puts planes on the card from Approaching on, not while they are still inbound', () => {
    expect(isOnCard({ stage: 'approaching', flight: 'ELY324' })).toBe(true);
    expect(isOnCard({ stage: 'overhead', flight: 'ELY324' })).toBe(true);
    expect(isOnCard({ stage: 'inbound', flight: 'ELY324' })).toBe(false);
  });

  it('keeps private planes flying under a tail number off the card', () => {
    for (const flight of ['4XBHV', 'DESMO', 'N131PC', 'N']) {
      expect(isOnCard({ stage: 'overhead', flight })).toBe(false);
    }
  });

  it('writes quiet hours as clock times', () => {
    expect(QUIET_HOURS.map(clockTime)).toEqual(['22:00', '07:00']);
  });

  it('rounds a location to about 100 m', () => {
    expect(roughLocation({ lat: 32.069_384_7, lon: 34.773_812_9 })).toEqual({ lat: 32.069, lon: 34.774 });
  });
});
