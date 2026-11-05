import { describe, expect, it } from 'vitest';
import { clockTime, isOnCard, QUIET_HOURS, roughLocation } from './rules.js';

describe('shared rules', () => {
  it('puts planes on the card from Approaching on, not while they are still inbound', () => {
    expect(isOnCard({ stage: 'approaching' })).toBe(true);
    expect(isOnCard({ stage: 'overhead' })).toBe(true);
    expect(isOnCard({ stage: 'inbound' })).toBe(false);
  });

  it('writes quiet hours as clock times', () => {
    expect(QUIET_HOURS.map(clockTime)).toEqual(['22:00', '07:00']);
  });

  it('rounds a location to about 100 m', () => {
    expect(roughLocation({ lat: 32.069_384_7, lon: 34.773_812_9 })).toEqual({ lat: 32.069, lon: 34.774 });
  });
});
