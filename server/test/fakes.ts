import type { ActivityProps, GeoPoint, NearbyPlane, RegisterRequest } from '@overhead/shared';
import type { Sky } from '../src/flights/sky.js';
import type { LiveActivityEvent, PushClient, PushResult } from '../src/push/apns.js';

export const nearbyPlane = (flight: string, overrides: Partial<NearbyPlane> = {}): NearbyPlane => ({
  id: flight.toLowerCase(),
  flight,
  aircraft: 'A320neo',
  altitudeFt: 3000,
  trackDeg: 90,
  distanceNm: 0.5,
  bearingDeg: 0,
  secondsLeft: 60,
  route: { from: 'LHR', fromCity: 'London', to: 'BER', toCity: 'Berlin' },
  ...overrides,
});

export class FakeSky implements Sky {
  planes: NearbyPlane[] = [];
  feedDown = false;
  planesAt?: (point: GeoPoint) => NearbyPlane[];

  async planesAbove(point: GeoPoint): Promise<NearbyPlane[]> {
    if (this.feedDown) throw new Error('All position feeds failed');
    return this.planesAt?.(point) ?? this.planes;
  }
}

export interface SentPush {
  token: string;
  event: LiveActivityEvent;
  props: ActivityProps;
}

export class FakePush implements PushClient {
  sent: SentPush[] = [];
  result: PushResult = 'delivered';

  async send(token: string, event: LiveActivityEvent, props: ActivityProps): Promise<PushResult> {
    this.sent.push({ token, event, props });
    return this.result;
  }
}

export const registerRequest = (overrides: Partial<RegisterRequest> = {}): RegisterRequest => ({
  deviceId: 'phone-1',
  lat: 52.5,
  lon: 13.4,
  startToken: 'start-token',
  activityTokens: [],
  quietHours: null,
  utcOffsetMinutes: 60,
  ...overrides,
});
