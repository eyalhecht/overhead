const COMPASS_POINTS = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
export const KM_PER_NM = 1.852;

export function compassDirection(bearingDeg: number): string {
  return COMPASS_POINTS[Math.round(bearingDeg / 45) % COMPASS_POINTS.length] ?? 'North';
}

export function formatDistance(distanceNm: number): string {
  return `${(distanceNm * KM_PER_NM).toFixed(1)} km`;
}

export function formatAltitude(altitudeFt: number): string {
  return `${altitudeFt.toLocaleString()} ft`;
}
