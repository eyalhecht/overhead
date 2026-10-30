import type { RegisterRequest } from '@overhead/shared';
import { initialActivityState, type ActivityState } from './activity/policy.js';
import type { GeoPoint } from './flights/positions.js';

const MINUTES_PER_DAY = 24 * 60;

export interface User {
  deviceId: string;
  location: GeoPoint;
  startToken?: string;
  activityTokens: Set<string>;
  endedTokens: Set<string>;
  quietHours: [number, number] | null;
  utcOffsetMinutes: number;
  activity: ActivityState;
}

export interface UserStore {
  upsert(request: RegisterRequest): User;
  all(): User[];
}

export class UserLimitError extends Error {
  constructor(limit: number) {
    super(`User limit of ${limit} reached`);
  }
}

export function createUserStore(maxUsers = 100): UserStore {
  const users = new Map<string, User>();

  return {
    upsert(request) {
      const existing = users.get(request.deviceId);
      if (!existing && users.size >= maxUsers) throw new UserLimitError(maxUsers);

      const user: User = existing ?? {
        deviceId: request.deviceId,
        location: { lat: request.lat, lon: request.lon },
        activityTokens: new Set(),
        endedTokens: new Set(),
        quietHours: null,
        utcOffsetMinutes: 0,
        activity: initialActivityState(),
      };
      user.location = { lat: request.lat, lon: request.lon };
      user.startToken = request.startToken;
      user.quietHours = request.quietHours;
      user.utcOffsetMinutes = request.utcOffsetMinutes;

      users.set(user.deviceId, user);
      return user;
    },

    all() {
      return [...users.values()];
    },
  };
}

export function isQuietTime(user: Pick<User, 'quietHours' | 'utcOffsetMinutes'>, now: number): boolean {
  if (!user.quietHours) return false;
  const [from, to] = user.quietHours;
  const localMinute = mod(Math.floor(now / 60_000) + user.utcOffsetMinutes, MINUTES_PER_DAY);
  return from <= to ? localMinute >= from && localMinute < to : localMinute >= from || localMinute < to;
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
