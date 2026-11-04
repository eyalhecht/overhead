import crypto from 'node:crypto';
import http2 from 'node:http2';
import type { ActivityProps, CardStage } from '@overhead/shared';
import type { ApnsConfig } from '../config.js';

export type LiveActivityEvent = 'start' | 'update' | 'end';
export type PushResult = 'delivered' | 'token-invalid' | 'failed';

export interface PushClient {
  send(token: string, event: LiveActivityEvent, props: ActivityProps): Promise<PushResult>;
}

const ACTIVITY_NAME = 'Overhead';
const OPEN_ON_TAP = 'overhead://look-up';
const STALE_AFTER_SECONDS = 60;
const ALERT_TITLES: Record<CardStage, string> = {
  approaching: 'Approaching',
  overhead: 'In sight',
  passed: 'Passed',
};
const AUTH_TOKEN_TTL_MS = 40 * 60_000;
const IDLE_CONNECTION_MS = 5 * 60_000;
const INVALID_TOKEN_REASONS = new Set([
  'BadDeviceToken',
  'Unregistered',
  'DeviceTokenNotForTopic',
  'ExpiredToken',
]);

export function buildLiveActivityPayload(event: LiveActivityEvent, props: ActivityProps, nowSeconds: number) {
  return {
    aps: {
      timestamp: nowSeconds,
      event,
      'content-state': { name: ACTIVITY_NAME, props: JSON.stringify(props) },
      ...(event === 'start' && {
        'attributes-type': 'LiveActivityAttributes',
        attributes: { url: OPEN_ON_TAP },
        'input-push-token': 1,
        alert: { title: ALERT_TITLES[props.stage], body: alertBody(props) },
      }),
      ...(event === 'end'
        ? { 'dismissal-date': nowSeconds }
        : { 'stale-date': nowSeconds + STALE_AFTER_SECONDS }),
    },
  };
}

function alertBody({ route, aircraft, flight }: ActivityProps): string {
  return route ? `${route.from} → ${route.to}` : (aircraft ?? flight);
}

export function pushPriority(event: LiveActivityEvent): '5' | '10' {
  return event === 'update' ? '5' : '10';
}

export function createApnsClient(config: ApnsConfig, now: () => number = Date.now): PushClient {
  let session: http2.ClientHttp2Session | undefined;
  let authToken = { value: '', issuedAt: 0 };

  function connection(): http2.ClientHttp2Session {
    if (!session || session.closed || session.destroyed) {
      const fresh = http2.connect(`https://${config.host}`);
      fresh.on('error', () => fresh.destroy());
      fresh.setTimeout(IDLE_CONNECTION_MS, () => fresh.close());
      session = fresh;
    }
    return session;
  }

  function bearerToken(): string {
    if (now() - authToken.issuedAt > AUTH_TOKEN_TTL_MS) {
      const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
      const unsigned = `${encode({ alg: 'ES256', kid: config.keyId })}.${encode({
        iss: config.teamId,
        iat: Math.floor(now() / 1000),
      })}`;
      const signature = crypto.sign('sha256', Buffer.from(unsigned), {
        key: config.privateKey,
        dsaEncoding: 'ieee-p1363',
      });
      authToken = { value: `${unsigned}.${signature.toString('base64url')}`, issuedAt: now() };
    }
    return authToken.value;
  }

  return {
    send(token, event, props) {
      return new Promise((resolve) => {
        const request = connection().request({
          ':method': 'POST',
          ':path': `/3/device/${token}`,
          authorization: `bearer ${bearerToken()}`,
          'apns-push-type': 'liveactivity',
          'apns-topic': `${config.bundleId}.push-type.liveactivity`,
          'apns-priority': pushPriority(event),
        });

        let status = 0;
        let body = '';
        request.setEncoding('utf8');
        request.on('response', (headers) => (status = Number(headers[':status'])));
        request.on('data', (chunk: string) => (body += chunk));
        request.on('end', () => resolve(interpretResponse(event, status, body)));
        request.on('error', (error) => {
          console.warn(`APNs ${event} failed: ${error.message}`);
          resolve('failed');
        });
        request.end(JSON.stringify(buildLiveActivityPayload(event, props, Math.floor(now() / 1000))));
      });
    },
  };
}

function interpretResponse(event: LiveActivityEvent, status: number, body: string): PushResult {
  if (status === 200) return 'delivered';
  const reason = parseReason(body);
  console.warn(`APNs rejected ${event} (${status} ${reason ?? 'no reason'})`);
  return status === 410 || (reason !== undefined && INVALID_TOKEN_REASONS.has(reason))
    ? 'token-invalid'
    : 'failed';
}

function parseReason(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null && 'reason' in parsed
      ? String(parsed.reason)
      : undefined;
  } catch {
    return undefined;
  }
}

export function createDryRunPushClient(onCardStarted: () => void = () => {}): PushClient {
  return {
    async send(_token, event, props) {
      if (event === 'start') onCardStarted();
      console.log(`[dry run] ${event.padEnd(6)} ${props.flight} ${alertBody(props)} (${props.stage})`);
      return 'delivered';
    },
  };
}
