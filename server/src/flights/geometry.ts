export const OVERHEAD_RADIUS_NM = 1.5;
export const OVERHEAD_MAX_ALTITUDE_FT = 10000;
const HOVER_SPEED_KT = 20;
const HOVER_SECONDS_LEFT = 60;
const SECONDS_PER_HOUR = 3600;

export interface Aircraft {
  id: string;
  flight: string;
  typeCode?: string;
  altitudeFt: number;
  groundSpeedKt: number;
  trackDeg: number;
  distanceNm: number;
  bearingDeg: number;
}

export function isOverhead(aircraft: Aircraft): boolean {
  return aircraft.altitudeFt <= OVERHEAD_MAX_ALTITUDE_FT && aircraft.distanceNm <= OVERHEAD_RADIUS_NM;
}

export function secondsUntilExit(aircraft: Aircraft, radiusNm = OVERHEAD_RADIUS_NM): number {
  if (aircraft.groundSpeedKt < HOVER_SPEED_KT) return HOVER_SECONDS_LEFT;

  const position = toVector(aircraft.distanceNm, aircraft.bearingDeg);
  const velocity = toVector(aircraft.groundSpeedKt / SECONDS_PER_HOUR, aircraft.trackDeg);

  const a = dot(velocity, velocity);
  const b = 2 * dot(position, velocity);
  const c = dot(position, position) - radiusNm * radiusNm;
  const discriminant = Math.max(0, b * b - 4 * a * c);
  const exitTime = (-b + Math.sqrt(discriminant)) / (2 * a);

  return Math.max(0, Math.round(exitTime));
}

interface Vector {
  x: number;
  y: number;
}

function toVector(length: number, bearingDeg: number): Vector {
  const radians = (bearingDeg * Math.PI) / 180;
  return { x: length * Math.sin(radians), y: length * Math.cos(radians) };
}

function dot(u: Vector, v: Vector): number {
  return u.x * v.x + u.y * v.y;
}
