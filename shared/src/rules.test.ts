import { describe, expect, it } from 'vitest';
import { clockTime, isOnCard, QUIET_HOURS } from './rules.js';

describe('shared rules', () => {
  it('puts planes on the card from Approaching on, not while they are still inbound', () => {
    expect(isOnCard({ stage: 'approaching' })).toBe(true);
    expect(isOnCard({ stage: 'overhead' })).toBe(true);
    expect(isOnCard({ stage: 'inbound' })).toBe(false);
  });

  it('writes quiet hours as clock times', () => {
    expect(QUIET_HOURS.map(clockTime)).toEqual(['22:00', '07:00']);
  });
});
