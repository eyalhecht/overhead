import { describe, expect, it } from 'vitest';
import { createUserStore, isQuietTime, UserLimitError } from '../src/users.js';

const NIGHT: [number, number] = [22 * 60, 7 * 60];
const utc = (hour: number, minute = 0) => Date.UTC(2026, 9, 29, hour, minute);

describe('isQuietTime', () => {
  it('wraps past midnight in the phone time zone', () => {
    const berlin = { quietHours: NIGHT, utcOffsetMinutes: 60 };
    expect(isQuietTime(berlin, utc(21, 30))).toBe(true);
    expect(isQuietTime(berlin, utc(5, 59))).toBe(true);
    expect(isQuietTime(berlin, utc(6, 0))).toBe(false);
    expect(isQuietTime(berlin, utc(12))).toBe(false);
  });

  it('respects other time zones', () => {
    expect(isQuietTime({ quietHours: NIGHT, utcOffsetMinutes: 120 }, utc(19, 30))).toBe(false);
  });

  it('is never quiet when quiet hours are off', () => {
    expect(isQuietTime({ quietHours: null, utcOffsetMinutes: 60 }, utc(23))).toBe(false);
  });
});

describe('createUserStore', () => {
  const request = (deviceId: string) => ({
    deviceId,
    lat: 52.5,
    lon: 13.4,
    activityTokens: [],
    quietHours: null,
    utcOffsetMinutes: 60,
  });

  it('updates an existing user instead of adding a new one', () => {
    const users = createUserStore();
    users.upsert(request('phone'));
    users.upsert({ ...request('phone'), lat: 51.5 });
    expect(users.all()).toHaveLength(1);
    expect(users.all()[0]?.location.lat).toBe(51.5);
  });

  it('refuses new users beyond the limit', () => {
    const users = createUserStore(1);
    users.upsert(request('first'));
    expect(() => users.upsert(request('second'))).toThrow(UserLimitError);
  });
});
