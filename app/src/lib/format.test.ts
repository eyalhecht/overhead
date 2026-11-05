import { describe, expect, it } from 'vitest';
import { compassDirection, formatDistance } from './format';

describe('where to look', () => {
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

describe('numbers on the app screen', () => {
  it('shows distance in kilometres', () => {
    expect(formatDistance(0.5)).toBe('0.9 km');
  });
});
