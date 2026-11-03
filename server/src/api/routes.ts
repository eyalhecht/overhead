import { CardQuerySchema, PlanesQuerySchema, RegisterRequestSchema, type GeoPoint } from '@overhead/shared';
import { Router } from 'express';
import type { Watcher } from '../activity/watcher.js';
import type { Sky } from '../flights/sky.js';
import { userLabel, type UserStore } from '../users.js';

export interface RouterDependencies {
  users: UserStore;
  sky: Sky;
  watcher: Watcher;
  demoLocation?: GeoPoint;
}

export function createRouter({ users, sky, watcher, demoLocation }: RouterDependencies): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const request = RegisterRequestSchema.parse(req.body);
    const isNewPhone = !users.find(request.deviceId);
    const user = users.upsert(request);
    if (isNewPhone) console.log(`${userLabel(user)} phone checked in`);
    await watcher.reportActivityTokens(user, request.activityTokens);
    res.status(204).end();
  });

  router.get('/planes', async (req, res) => {
    const { lat, lon } = PlanesQuerySchema.parse(req.query);
    res.json(await sky.planesAbove(demoLocation ?? { lat, lon }));
  });

  router.get('/card', (req, res) => {
    const { deviceId } = CardQuerySchema.parse(req.query);
    res.json(users.find(deviceId)?.activity.showing?.props ?? null);
  });

  return router;
}
