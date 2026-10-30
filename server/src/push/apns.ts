import crypto from 'node:crypto';
import http2 from 'node:http2';
import type { ActivityProps } from '@overhead/shared';
import type { ApnsConfig } from '../config.js';

export type LiveActivityEvent = 'start' | 'update' | 'end';
export type PushResult = 'delivered' | 'token-invalid' | 'failed';

export interface PushClient {
  send(token: string, event: LiveActivityEvent, props: ActivityProps): Promise<PushResult>;
}

const ACTIVITY_NAME = 'Overhead';
const STALE_SECONDS_AFTER_COUNTDOWN = 30;
const AUTH_TOKEN_TTL_MS = 40 * 60_000;
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
        attributes: {},
        'input-push-token': 1,
        alert: { title: 'Above you now', body: `${props.from} → ${props.to}` },
      }),
      ...(event === 'end'
        ? { 'dismissal-date': nowSeconds }
        : { 'stale-date': Math.ceil(props.endsAt / 1000) + STALE_SECONDS_AFTER_COUNTDOWN }),
    },
  };
}

export function pushPriority(event: LiveActivityEvent): '5' | '10' {
  return event === 'update' ? '5' : '10';
}

export function createApnsClient(config: ApnsConfig, now: () => number = Date.now): PushClient {
  let session: http2.ClientHttp2Session | undefined;
  let authToken = { value: '', issuedAt: 0 };

  function connection(): http2.ClientHttp2Session {
    if (!session || session.closed || session.destroyed) {
      session = http2.connect(`https://${config.host}`);
      session.on('error', () => session?.destroy());
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
      const secondsLeft = Math.round((props.endsAt - Date.now()) / 1000);
      const second = props.second ? ` + ${props.second.flight}` : '';
      console.log(
        `[dry run] ${event.padEnd(6)} ${props.flight} ${props.from} → ${props.to} ~${secondsLeft}s${second}`,
      );
      return 'delivered';
    },
  };
}
