import { generateKeyPairSync, verify, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http2, { type IncomingHttpHeaders, type ServerHttp2Session } from 'node:http2';
import type { AddressInfo } from 'node:net';
import { cardText, type ActivityProps } from '@overhead/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLiveActivityPayload, createApnsClient, type PushClient } from '../src/push/apns.js';

interface ReceivedPush {
  headers: IncomingHttpHeaders;
  body: { aps: Record<string, unknown> };
}

interface AppleReply {
  status: number;
  reason?: string;
}

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

const card: ActivityProps = {
  flight: 'ETD597',
  airline: 'Etihad Airways',
  aircraft: 'A321neo',
  route: { from: 'AUH', fromCity: 'Abu Dhabi', to: 'TLV', toCity: 'Tel Aviv' },
  stage: 'approaching',
};

class FakeApple {
  received: ReceivedPush[] = [];
  reply: AppleReply = { status: 200 };
  private readonly sessions = new Set<ServerHttp2Session>();
  private readonly server = http2.createSecureServer({
    key: fixture('localhost-key.pem'),
    cert: fixture('localhost-cert.pem'),
  });

  async listen(): Promise<string> {
    this.server.on('session', (session) => {
      this.sessions.add(session);
      session.on('close', () => this.sessions.delete(session));
    });
    this.server.on('stream', (stream, headers) => {
      let body = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => (body += chunk));
      stream.on('end', () => {
        this.received.push({ headers, body: JSON.parse(body) });
        stream.respond({ ':status': this.reply.status });
        stream.end(this.reply.reason ? JSON.stringify({ reason: this.reply.reason }) : undefined);
      });
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `localhost:${(this.server.address() as AddressInfo).port}`;
  }

  dropConnections(): void {
    this.sessions.forEach((session) => session.destroy());
  }

  async close(): Promise<void> {
    this.dropConnections();
    await new Promise((resolve) => this.server.close(resolve));
  }
}

function decodeJwt(token: string) {
  const [header = '', claims = '', signature = ''] = token.split('.');
  const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());
  return { header: decode(header), claims: decode(claims), signed: `${header}.${claims}`, signature };
}

describe('APNs client', () => {
  let apple: FakeApple;
  let apns: PushClient;
  let publicKey: KeyObject;
  let now: number;

  beforeEach(async () => {
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    publicKey = keys.publicKey;
    now = Date.UTC(2026, 10, 1, 12);
    apple = new FakeApple();
    const host = await apple.listen();
    apns = createApnsClient(
      {
        privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        keyId: 'KEY1234567',
        teamId: 'TEAM123456',
        bundleId: 'com.example.overhead',
        host,
      },
      () => now,
    );
  });

  afterEach(async () => {
    await apple.close();
    vi.unstubAllEnvs();
  });

  it('delivers a start push with the headers Apple requires for Live Activities', async () => {
    expect(await apns.send('start-token', 'start', card)).toBe('delivered');

    const [push] = apple.received;
    expect(push?.headers).toMatchObject({
      ':method': 'POST',
      ':path': '/3/device/start-token',
      'apns-push-type': 'liveactivity',
      'apns-topic': 'com.example.overhead.push-type.liveactivity',
      'apns-priority': '10',
    });
    expect(push?.body.aps).toMatchObject({
      event: 'start',
      alert: { title: 'Approaching', body: 'Abu Dhabi → Tel Aviv' },
    });
  });

  it('sends routine updates at the low priority that does not use the iOS budget', async () => {
    await apns.send('card-token', 'update', card);
    expect(apple.received[0]?.headers['apns-priority']).toBe('5');
  });

  it('signs every push with a valid ES256 token from the team key', async () => {
    await apns.send('card-token', 'update', card);

    const authorization = String(apple.received[0]?.headers.authorization);
    const jwt = decodeJwt(authorization.replace('bearer ', ''));
    expect(jwt.header).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(jwt.claims).toEqual({ iss: 'TEAM123456', iat: now / 1000 });
    const valid = verify(
      'sha256',
      Buffer.from(jwt.signed),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(jwt.signature, 'base64url'),
    );
    expect(valid).toBe(true);
  });

  it('reuses its token for a while and signs a new one before Apple would reject it after an hour', async () => {
    await apns.send('card-token', 'update', card);
    now += 30 * 60_000;
    await apns.send('card-token', 'update', card);
    now += 15 * 60_000;
    await apns.send('card-token', 'update', card);

    const issuedAt = apple.received.map(
      ({ headers }) => decodeJwt(String(headers.authorization).slice(7)).claims.iat,
    );
    expect(issuedAt[0]).toBe(issuedAt[1]);
    expect(issuedAt[2]).toBeGreaterThan(issuedAt[1]);
  });

  it.each([
    [410, 'Unregistered'],
    [400, 'BadDeviceToken'],
    [400, 'DeviceTokenNotForTopic'],
  ])('reports the token as invalid when Apple answers %i %s', async (status, reason) => {
    apple.reply = { status, reason };
    expect(await apns.send('old-token', 'update', card)).toBe('token-invalid');
  });

  it.each([
    [429, 'TooManyRequests'],
    [500, 'InternalServerError'],
    [503, 'ServiceUnavailable'],
  ])('keeps the token when Apple answers %i %s', async (status, reason) => {
    apple.reply = { status, reason };
    expect(await apns.send('card-token', 'update', card)).toBe('failed');
  });

  it('reconnects after the network drops the connection', async () => {
    expect(await apns.send('card-token', 'update', card)).toBe('delivered');

    apple.dropConnections();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const results = [
      await apns.send('card-token', 'update', card),
      await apns.send('card-token', 'update', card),
    ];

    expect(results).toContain('delivered');
    expect(results.at(-1)).toBe('delivered');
  });
});

describe('Live Activity payload', () => {
  const nowSeconds = Date.UTC(2026, 10, 1, 12) / 1000;

  it('lets a start push create the card and ask for its update token', () => {
    const { aps } = buildLiveActivityPayload('start', card, nowSeconds);
    expect(aps).toMatchObject({
      event: 'start',
      'attributes-type': 'LiveActivityAttributes',
      'input-push-token': 1,
    });
  });

  it('opens the app when the card is tapped', () => {
    const { aps } = buildLiveActivityPayload('start', card, nowSeconds);
    expect(aps).toMatchObject({ attributes: { url: 'overhead://' } });
  });

  it('names a plane without a known route by what we know in the alert', () => {
    const { aps } = buildLiveActivityPayload('start', { ...card, route: null }, nowSeconds);
    expect(aps).toMatchObject({ alert: { body: 'Etihad Airways · A321neo' } });
  });

  it('marks the card stale when no update arrives for a minute', () => {
    const { aps } = buildLiveActivityPayload('update', card, nowSeconds);
    expect(aps).toMatchObject({ 'stale-date': nowSeconds + 60 });
  });

  it('dismisses an ended card at once', () => {
    const { aps } = buildLiveActivityPayload('end', card, nowSeconds);
    expect(aps).toMatchObject({ event: 'end', 'dismissal-date': nowSeconds });
    expect(aps).not.toHaveProperty('stale-date');
  });

  it('carries the card exactly as the widget will read it', () => {
    const { aps } = buildLiveActivityPayload('update', card, nowSeconds);
    const state = aps['content-state'] as { name: string; props: string };
    expect(state.name).toBe('Overhead');
    expect(JSON.parse(state.props)).toEqual({ ...card, ...cardText(card) });
  });
});
