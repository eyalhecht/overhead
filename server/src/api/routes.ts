import { PlanesQuerySchema, RegisterRequestSchema } from '@overhead/shared';
import { Router } from 'express';
import type { Watcher } from '../activity/watcher.js';
import type { GeoPoint } from '../flights/positions.js';
import type { Sky } from '../flights/sky.js';
import type { UserStore } from '../users.js';

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
    const user = users.upsert(request);
    await watcher.reportActivityTokens(user, request.activityTokens);
    res.status(204).end();
  });

  router.get('/planes', async (req, res) => {
    const { lat, lon } = PlanesQuerySchema.parse(req.query);
    res.json(await sky.planesAbove(demoLocation ?? { lat, lon }));
  });

  return router;
}
