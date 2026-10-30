import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createWatcher } from '../src/activity/watcher.js';
import { createApp } from '../src/api/app.js';
import { createUserStore, type UserStore } from '../src/users.js';
import { FakePush, FakeSky, nearbyPlane, registerRequest } from './fakes.js';

const APP_KEY = 'test-key';

describe('API', () => {
  let sky: FakeSky;
  let users: UserStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    sky = new FakeSky();
    users = createUserStore();
    const watcher = createWatcher({ users, sky, push: new FakePush() });
    app = createApp({ appKey: APP_KEY, users, sky, watcher });
  });

  const authorized = (req: request.Test) => req.set('x-app-key', APP_KEY);

  it('rejects requests without the app key', async () => {
    await request(app).get('/planes?lat=52.5&lon=13.4').expect(401);
  });

  it('registers a phone', async () => {
    await authorized(request(app).post('/register')).send(registerRequest()).expect(204);
    expect(users.all()).toHaveLength(1);
  });

  it('rejects an invalid registration', async () => {
    const response = await authorized(request(app).post('/register'))
      .send(registerRequest({ lat: 999 }))
      .expect(400);
    expect(response.body.error).toBe('Invalid request');
  });

  it('rejects an oversized body', async () => {
    await authorized(request(app).post('/register'))
      .send({ ...registerRequest(), padding: 'x'.repeat(5000) })
      .expect(413);
  });

  it('returns the planes above a point', async () => {
    sky.planes = [nearbyPlane('BAW1')];
    const response = await authorized(request(app).get('/planes?lat=52.5&lon=13.4')).expect(200);
    expect(response.body).toEqual([nearbyPlane('BAW1')]);
  });

  it('rejects impossible coordinates', async () => {
    await authorized(request(app).get('/planes?lat=999&lon=13.4')).expect(400);
  });
});
