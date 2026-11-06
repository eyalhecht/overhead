import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUserStore, sqliteStorage, UserLimitError, type UserStore } from '../src/users.js';
import { registerRequest } from './fakes.js';

describe('createUserStore', () => {
  const request = (deviceId: string) => registerRequest({ deviceId, startToken: undefined });

  it('updates an existing user instead of adding a new one', () => {
    const users = createUserStore();
    users.upsert(request('phone'));
    users.upsert({ ...request('phone'), lat: 51.5 });
    expect(users.all()).toHaveLength(1);
    expect(users.all()[0]?.location.lat).toBe(51.5);
  });

  it('replaces the old entry when a reinstalled app checks in with the same push token', () => {
    const users = createUserStore();
    users.upsert({ ...request('old-install'), startToken: 'start-token' });
    users.upsert({ ...request('new-install'), startToken: 'start-token' });
    expect(users.all().map((user) => user.deviceId)).toEqual(['new-install']);
  });

  it('refuses new users beyond the limit', () => {
    const users = createUserStore({ maxUsers: 1 });
    users.upsert(request('first'));
    expect(() => users.upsert(request('second'))).toThrow(UserLimitError);
  });
});

describe('saving users', () => {
  const request = registerRequest({ deviceId: 'phone', lat: 32.069, lon: 34.774, startToken: undefined });
  const DAY_MS = 24 * 60 * 60_000;
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'overhead-users-'));
  });
  afterEach(() => {
    opened.splice(0).forEach((store) => store.close());
    rmSync(folder, { recursive: true, force: true });
  });

  const opened: UserStore[] = [];
  const openStore = (now = Date.UTC(2026, 10, 5)) => {
    const store = createUserStore({ storage: sqliteStorage(join(folder, 'overhead.db')), now: () => now });
    opened.push(store);
    return store;
  };

  it('keeps users and their open card across a server restart', () => {
    const before = openStore();
    const user = before.upsert({ ...request, startToken: 'start-token' });
    user.activity = { ...user.activity, cardTokens: ['card-1'], recentStarts: [123] };
    before.save(user);

    const after = openStore();
    expect(after.find('phone')).toMatchObject({
      startToken: 'start-token',
      location: { lat: 32.069, lon: 34.774 },
      activity: { cardTokens: ['card-1'], recentStarts: [123] },
    });
  });

  it('does not bring back a phone that a reinstall replaced while it was being watched', () => {
    const before = openStore();
    const oldInstall = before.upsert({ ...request, startToken: 'start-token' });
    before.upsert({ ...request, deviceId: 'phone-reinstalled', startToken: 'start-token' });
    before.save(oldInstall);

    const after = openStore();
    expect(after.find('phone')).toBeUndefined();
    expect(after.find('phone-reinstalled')).toBeDefined();
  });

  it('forgets a phone that has not checked in for 30 days', () => {
    const start = Date.UTC(2026, 10, 5);
    openStore(start).upsert(request);

    expect(openStore(start + 29 * DAY_MS).all()).toHaveLength(1);
    expect(openStore(start + 31 * DAY_MS).all()).toHaveLength(0);
    expect(openStore(start).all()).toHaveLength(0);
  });

  it.skipIf(process.platform === 'win32')('keeps the database readable only by the server', () => {
    openStore().upsert(request);
    expect(statSync(join(folder, 'overhead.db')).mode & 0o777).toBe(0o600);
  });
});
