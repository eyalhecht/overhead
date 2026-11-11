import type { GeoPoint, RegisterRequest } from '@overhead/shared';
import Database from 'better-sqlite3';
import { closeSync, openSync } from 'node:fs';
import { initialActivityState, type ActivityState } from './activity/policy.js';

const FORGET_AFTER_MS = 30 * 24 * 60 * 60_000;
const OWNER_ONLY = 0o600;

export interface User {
  deviceId: string;
  location: GeoPoint;
  startToken?: string;
  quietHours: [number, number] | null;
  utcOffsetMinutes: number;
  lastSeenAt: number;
  activity: ActivityState;
}

export interface UserStore {
  upsert(request: RegisterRequest): User;
  find(deviceId: string): User | undefined;
  all(): User[];
  save(user: User): void;
  close(): void;
}

export interface UserStorage {
  load(): User[];
  write(user: User): void;
  remove(deviceId: string): void;
  close(): void;
}

interface UserStoreOptions {
  maxUsers?: number;
  storage?: UserStorage;
  now?: () => number;
}

export class UserLimitError extends Error {
  constructor(limit: number) {
    super(`User limit of ${limit} reached`);
  }
}

export function createUserStore({
  maxUsers = 20_000,
  storage = memoryStorage(),
  now = Date.now,
}: UserStoreOptions = {}): UserStore {
  const users = new Map(storage.load().map((user) => [user.deviceId, user]));

  function forgetSilentPhones(): void {
    for (const user of users.values()) {
      if (now() - user.lastSeenAt <= FORGET_AFTER_MS) continue;
      users.delete(user.deviceId);
      storage.remove(user.deviceId);
    }
  }
  forgetSilentPhones();

  // A reinstalled app gets a new device ID but keeps its push token, so the token marks the phone.
  function forgetOtherInstalls({ deviceId, startToken }: RegisterRequest): void {
    if (!startToken) return;
    for (const user of users.values()) {
      if (user.deviceId === deviceId || user.startToken !== startToken) continue;
      users.delete(user.deviceId);
      storage.remove(user.deviceId);
    }
  }

  return {
    upsert(request) {
      forgetOtherInstalls(request);
      const existing = users.get(request.deviceId);
      if (!existing && users.size >= maxUsers) throw new UserLimitError(maxUsers);

      const profile = {
        location: { lat: request.lat, lon: request.lon },
        startToken:
          request.startToken === undefined ? existing?.startToken : (request.startToken ?? undefined),
        quietHours: request.quietHours,
        utcOffsetMinutes: request.utcOffsetMinutes,
        lastSeenAt: now(),
      };
      const user: User = existing
        ? Object.assign(existing, profile)
        : {
            deviceId: request.deviceId,
            activity: initialActivityState(),
            ...profile,
          };
      users.set(user.deviceId, user);
      storage.write(user);
      return user;
    },

    find(deviceId) {
      return users.get(deviceId);
    },

    all() {
      forgetSilentPhones();
      return [...users.values()];
    },

    save(user) {
      if (users.get(user.deviceId) === user) storage.write(user);
    },

    close() {
      storage.close();
    },
  };
}

export function memoryStorage(): UserStorage {
  return { load: () => [], write: () => undefined, remove: () => undefined, close: () => undefined };
}

export function sqliteStorage(path: string): UserStorage {
  closeSync(openSync(path, 'a', OWNER_ONLY));
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec('CREATE TABLE IF NOT EXISTS users (device_id TEXT PRIMARY KEY, data TEXT NOT NULL)');
  const upsert = db.prepare(
    'INSERT INTO users (device_id, data) VALUES (?, ?) ON CONFLICT (device_id) DO UPDATE SET data = excluded.data',
  );
  const remove = db.prepare('DELETE FROM users WHERE device_id = ?');
  const selectAll = db.prepare<[], { data: string }>('SELECT data FROM users');

  const written = new Map<string, string>();

  return {
    load: () =>
      selectAll.all().map(({ data }) => {
        const user = JSON.parse(data) as User;
        written.set(user.deviceId, data);
        return { ...user, activity: { ...initialActivityState(), ...user.activity } };
      }),
    write: (user) => {
      const data = JSON.stringify(user);
      if (written.get(user.deviceId) === data) return;
      upsert.run(user.deviceId, data);
      written.set(user.deviceId, data);
    },
    remove: (deviceId) => {
      remove.run(deviceId);
      written.delete(deviceId);
    },
    close: () => db.close(),
  };
}
export function userLabel({ deviceId }: Pick<User, 'deviceId'>): string {
  return `[${deviceId.slice(0, 8)}]`;
}
