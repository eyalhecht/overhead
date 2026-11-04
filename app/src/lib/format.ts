import type { ActivityProps, CardStage } from '@overhead/shared';

const COMPASS_POINTS = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
export const KM_PER_NM = 1.852;
const METERS_PER_FOOT = 0.3048;
const METERS_PER_NM = 1852;
const STAGE_WORDS: Record<CardStage, string> = {
  approaching: 'Approaching',
  overhead: 'In sight',
  passed: 'Passed',
};

export function compassDirection(bearingDeg: number): string {
  return COMPASS_POINTS[Math.round(bearingDeg / 45) % COMPASS_POINTS.length] ?? 'North';
}

export function formatDistance(distanceNm: number): string {
  return `${(distanceNm * KM_PER_NM).toFixed(1)} km`;
}

export function formatAltitude(altitudeFt: number): string {
  return `${altitudeFt.toLocaleString()} ft`;
}

export function describeStage(stage: CardStage): string {
  return STAGE_WORDS[stage];
}

export function cardTitle({ route }: ActivityProps): string {
  return route ? `${route.fromCity} → ${route.toCity}` : 'Route unknown';
}

export function cardDetails({ airline, aircraft, flight }: ActivityProps): string {
  return [airline ?? flight, aircraft].filter(Boolean).join(' · ');
}

export function relativeBearing(bearingDeg: number, headingDeg: number): number {
  return ((bearingDeg - headingDeg + 540) % 360) - 180;
}

export function elevationAngle(altitudeFt: number, distanceNm: number): number {
  const radians = Math.atan2(altitudeFt * METERS_PER_FOOT, distanceNm * METERS_PER_NM);
  return Math.round((radians * 180) / Math.PI);
}

export function describeDirection(relativeDeg: number): string {
  const angle = Math.abs(relativeDeg);
  const side = relativeDeg > 0 ? 'right' : 'left';
  if (angle < 20) return 'Straight ahead';
  if (angle < 70) return `Ahead and to the ${side}`;
  if (angle < 110) return `To your ${side}`;
  if (angle < 160) return `Behind you, to the ${side}`;
  return 'Behind you';
}
