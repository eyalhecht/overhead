import { RegisterRequestSchema, SkyQuerySchema, type SkySnapshot } from '@overhead/shared';
import { Router, type Response } from 'express';
import type { Watcher } from '../activity/watcher.js';
import { userLabel, type UserStore } from '../users.js';

export interface RouterDependencies {
  users: UserStore;
  watcher: Watcher;
  now?: () => number;
}

const REQUESTS_PER_MINUTE = { register: 30, sky: 60 };

export function createRouter({ users, watcher, now = Date.now }: RouterDependencies): Router {
  const router = Router();
  const allowRegister = rateLimit(REQUESTS_PER_MINUTE.register, now);
  const allowSky = rateLimit(REQUESTS_PER_MINUTE.sky, now);

  router.post('/register', async (req, res) => {
    const request = RegisterRequestSchema.parse(req.body);
    if (!allowRegister(request.deviceId)) return tooMany(res);
    const isNewPhone = !users.find(request.deviceId);
    const user = users.upsert(request);
    if (isNewPhone) console.log(`${userLabel(user)} phone checked in`);
    await watcher.reportCardTokens(user, request.activityTokens);
    res.status(204).end();
  });

  router.get('/sky', (req, res) => {
    const { deviceId } = SkyQuerySchema.parse(req.query);
    if (!allowSky(deviceId)) return tooMany(res);
    const user = users.find(deviceId);
    if (user) watcher.appOpened(user);
    const snapshot: SkySnapshot = {
      planes: user ? watcher.planesFor(user) : [],
      card: user?.activity.showing?.props ?? null,
    };
    res.json(snapshot);
  });

  return router;
}

// A fixed one-minute window per device: enough for the app's polling, not for a script hammering the server.
function rateLimit(perMinute: number, now: () => number): (deviceId: string) => boolean {
  const windows = new Map<string, { startedAt: number; count: number }>();
  return (deviceId) => {
    for (const [key, window] of windows) if (now() - window.startedAt >= 60_000) windows.delete(key);
    const window = windows.get(deviceId) ?? { startedAt: now(), count: 0 };
    window.count += 1;
    windows.set(deviceId, window);
    return window.count <= perMinute;
  };
}

function tooMany(res: Response): void {
  res.status(429).json({ error: 'Too many requests' });
}
