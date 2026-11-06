import { RegisterRequestSchema, SkyQuerySchema, type SkySnapshot } from '@overhead/shared';
import { Router } from 'express';
import type { Watcher } from '../activity/watcher.js';
import { userLabel, type UserStore } from '../users.js';

export interface RouterDependencies {
  users: UserStore;
  watcher: Watcher;
}

export function createRouter({ users, watcher }: RouterDependencies): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const request = RegisterRequestSchema.parse(req.body);
    const isNewPhone = !users.find(request.deviceId);
    const user = users.upsert(request);
    if (isNewPhone) console.log(`${userLabel(user)} phone checked in`);
    await watcher.reportCardTokens(user, request.activityTokens);
    res.status(204).end();
  });

  router.get('/sky', (req, res) => {
    const { deviceId } = SkyQuerySchema.parse(req.query);
    const user = users.find(deviceId);
    const snapshot: SkySnapshot = {
      planes: user ? watcher.planesFor(user) : [],
      card: user?.activity.showing?.props ?? null,
    };
    res.json(snapshot);
  });

  return router;
}
