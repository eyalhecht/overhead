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

export interface FlightOnCard extends Route {
  flight: string;
  endsAt: number;
}

export interface ActivityProps extends FlightOnCard {
  aircraft?: string;
  rare?: string;
  altitudeFt: number;
  second?: FlightOnCard;
  more: number;
}

export interface NearbyPlane {
  id: string;
  flight: string;
  aircraft?: string;
  rare?: string;
  altitudeFt: number;
  trackDeg: number;
  distanceNm: number;
  bearingDeg: number;
  secondsLeft: number;
  route: Route | null;
}

export type RoutedPlane = NearbyPlane & { route: Route };

export const hasRoute = (plane: NearbyPlane): plane is RoutedPlane => plane.route !== null;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const minuteOfDay = z.number().int().min(0).max(1439);
const pushToken = z.string().regex(/^[\w+/=-]{1,300}$/);

export const RegisterRequestSchema = z.object({
  deviceId: z.string().min(1).max(64),
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
