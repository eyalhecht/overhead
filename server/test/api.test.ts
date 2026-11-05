import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWatcher, type Watcher } from '../src/activity/watcher.js';
import { createApp } from '../src/api/app.js';
import { createUserStore, type UserStore } from '../src/users.js';
import { FakePush, FakeSky, nearbyPlane, registerRequest } from './fakes.js';

const APP_KEY = 'test-key';

describe('API', () => {
  let sky: FakeSky;
  let users: UserStore;
  let watcher: Watcher;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    sky = new FakeSky();
    users = createUserStore();
    watcher = createWatcher({ users, sky, push: new FakePush() });
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

  it('logs a phone the first time it checks in, and stays quiet after that', async () => {
    const log = vi.mocked(console.log);
    await authorized(request(app).post('/register'))
      .send(registerRequest({ deviceId: 'AC1C8C25-1234' }))
      .expect(204);
    await authorized(request(app).post('/register'))
      .send(registerRequest({ deviceId: 'AC1C8C25-1234' }))
      .expect(204);

    expect(log.mock.calls.flat()).toEqual(['[AC1C8C25] phone checked in']);
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

  it('accepts a check-in with real-length iOS push tokens', async () => {
    const pushToStart = 'a1'.repeat(80);
    const cardToken = 'f0'.repeat(80);
    await authorized(request(app).post('/register'))
      .send(registerRequest({ startToken: pushToStart, activityTokens: [cardToken] }))
      .expect(204);
    expect(users.all()[0]?.startToken).toBe(pushToStart);
  });

  it('still accepts check-ins from a newer app that sends extra fields', async () => {
    await authorized(request(app).post('/register'))
      .send({ ...registerRequest(), appVersion: '1.4.0', units: 'imperial' })
      .expect(204);
  });

  it('accepts time zones that are not whole hours, like India and Nepal', async () => {
    for (const utcOffsetMinutes of [330, 345, -210]) {
      await authorized(request(app).post('/register'))
        .send(registerRequest({ utcOffsetMinutes }))
        .expect(204);
    }
  });

  it('stops new cards when the user turns Live Activities off in the app', async () => {
    await authorized(request(app).post('/register')).send(registerRequest()).expect(204);

    await authorized(request(app).post('/register'))
      .send(registerRequest({ startToken: undefined }))
      .expect(204);

    expect(users.all()[0]?.startToken).toBeUndefined();
  });

  it('asks a phone to try again later when the server is full', async () => {
    const full = createUserStore({ maxUsers: 1 });
    const fullApp = createApp({
      appKey: APP_KEY,
      users: full,
      sky,
      watcher: createWatcher({ users: full, sky, push: new FakePush() }),
    });
    await authorized(request(fullApp).post('/register'))
      .send(registerRequest({ deviceId: 'first' }))
      .expect(204);

    await authorized(request(fullApp).post('/register'))
      .send(registerRequest({ deviceId: 'second' }))
      .expect(503);
  });

  it('answers broken JSON with 400 instead of crashing', async () => {
    await authorized(request(app).post('/register'))
      .set('content-type', 'application/json')
      .send('{"deviceId": "phone-1",')
      .expect(400);
  });

  it('rejects an app key that is only partly right', async () => {
    await request(app).get('/planes?lat=52.5&lon=13.4').set('x-app-key', 'test-ke').expect(401);
    await request(app).get('/planes?lat=52.5&lon=13.4').set('x-app-key', 'test-kez').expect(401);
  });

  it('rejects a token that could smuggle a path into the request to Apple', async () => {
    await authorized(request(app).post('/register'))
      .send(registerRequest({ startToken: '../../3/device/other' }))
      .expect(400);
  });

  describe('the card a phone is showing', () => {
    const cardOf = (deviceId: string) => authorized(request(app).get(`/card?deviceId=${deviceId}`));

    it('matches the Live Activity, so the app can show the same plane', async () => {
      await authorized(request(app).post('/register')).send(registerRequest()).expect(204);
      sky.planes = [nearbyPlane('ISR053', { airline: 'Israir', stage: 'approaching' })];
      await watcher.tick();

      const response = await cardOf('phone-1').expect(200);

      expect(response.body).toMatchObject({ flight: 'ISR053', airline: 'Israir', stage: 'approaching' });
    });

    it('still shows the plane as Passed while the card says so', async () => {
      await authorized(request(app).post('/register')).send(registerRequest()).expect(204);
      sky.planes = [nearbyPlane('ISR053')];
      await watcher.tick();
      sky.planes = [];
      await watcher.tick();

      const response = await cardOf('phone-1').expect(200);

      expect(response.body).toMatchObject({ flight: 'ISR053', stage: 'passed' });
    });

    it('is empty when the phone shows no card', async () => {
      await authorized(request(app).post('/register')).send(registerRequest()).expect(204);
      const response = await cardOf('phone-1').expect(200);
      expect(response.body).toBeNull();
    });

    it('is empty for a phone the server does not know yet', async () => {
      const response = await cardOf('never-registered').expect(200);
      expect(response.body).toBeNull();
    });

    it('needs a device id', async () => {
      await authorized(request(app).get('/card')).expect(400);
    });
  });
});
