import { z } from 'zod';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Route {
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
}

export type PassStage = 'inbound' | 'approaching' | 'overhead';

export type CardStage = 'approaching' | 'overhead' | 'passed';

export interface NearbyPlane {
  id: string;
  flight: string;
  airline?: string;
  aircraft?: string;
  altitudeFt: number;
  trackDeg: number;
  distanceNm: number;
  bearingDeg: number;
  stage: PassStage;
  route: Route | null;
}

export interface ActivityProps {
  flight: string;
  airline?: string;
  aircraft?: string;
  route: Route | null;
  stage: CardStage;
}

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const minuteOfDay = z.number().int().min(0).max(1439);
const pushToken = z.string().regex(/^[\w+/=-]{1,300}$/);
const deviceId = z.string().min(1).max(64);

export const RegisterRequestSchema = z.object({
  deviceId,
  lat: latitude,
  lon: longitude,
  startToken: pushToken.optional(),
  activityTokens: z.array(pushToken).max(10),
  quietHours: z.tuple([minuteOfDay, minuteOfDay]).nullable(),
  utcOffsetMinutes: z.number().int().min(-840).max(840),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const PlanesQuerySchema = z.object({
  lat: z.coerce.number().pipe(latitude),
  lon: z.coerce.number().pipe(longitude),
});

export type PlanesQuery = z.infer<typeof PlanesQuerySchema>;

export const CardQuerySchema = z.object({ deviceId });
