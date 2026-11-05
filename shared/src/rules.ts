import type { NearbyPlane } from './index.js';

export const CARD_MAX_AGE_MS = 30 * 60_000;
export const QUIET_HOURS: [number, number] = [22 * 60, 7 * 60];
export const LOCATION_DECIMALS = 3;

export function isOnCard<Plane extends Pick<NearbyPlane, 'stage'>>(
  plane: Plane,
): plane is Plane & { stage: Exclude<Plane['stage'], 'inbound'> } {
  return plane.stage !== 'inbound';
}

export function clockTime(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
