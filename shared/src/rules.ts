import type { GeoPoint, NearbyPlane } from './index.js';

export const CARD_MAX_AGE_MS = 30 * 60_000;
export const QUIET_HOURS: [number, number] = [22 * 60, 7 * 60];
export const AIRLINE_CALLSIGN = /^([A-Z]{3})\d/;
const LOCATION_DECIMALS = 3;

// Private planes fly under their tail number and file no public route, so only airline flights get a card.
export function isOnCard<Plane extends Pick<NearbyPlane, 'stage' | 'flight'>>(
  plane: Plane,
): plane is Plane & { stage: Exclude<Plane['stage'], 'inbound'> } {
  return plane.stage !== 'inbound' && AIRLINE_CALLSIGN.test(plane.flight);
}

export function clockTime(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function roughLocation({ lat, lon }: GeoPoint): GeoPoint {
  return { lat: Number(lat.toFixed(LOCATION_DECIMALS)), lon: Number(lon.toFixed(LOCATION_DECIMALS)) };
}
