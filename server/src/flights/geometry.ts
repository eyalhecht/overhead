import type { PassStage } from '@overhead/shared';

const OVERHEAD_RADIUS_NM = 1.5;
const OVERHEAD_MAX_ALTITUDE_FT = 10_000;
const APPROACH_LEAD_SECONDS = 45;
const INBOUND_LEAD_SECONDS = 120;
const HOVER_SPEED_KT = 40;
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

export interface ClosestApproach {
  distanceNm: number;
  inSeconds: number;
}

export function passStage(aircraft: Aircraft): PassStage | null {
  if (aircraft.altitudeFt > OVERHEAD_MAX_ALTITUDE_FT || aircraft.groundSpeedKt < HOVER_SPEED_KT) return null;
  if (aircraft.distanceNm <= OVERHEAD_RADIUS_NM) return 'overhead';

  const { distanceNm, inSeconds } = closestApproach(aircraft);
  if (distanceNm > OVERHEAD_RADIUS_NM) return null;
  if (inSeconds <= APPROACH_LEAD_SECONDS) return 'approaching';
  return inSeconds <= INBOUND_LEAD_SECONDS ? 'inbound' : null;
}

export function closestApproach(aircraft: Aircraft): ClosestApproach {
  const position = toVector(aircraft.distanceNm, aircraft.bearingDeg);
  const velocity = toVector(aircraft.groundSpeedKt / SECONDS_PER_HOUR, aircraft.trackDeg);

  const speedSquared = dot(velocity, velocity);
  const inSeconds = speedSquared === 0 ? 0 : Math.max(0, -dot(position, velocity) / speedSquared);
  const closest = { x: position.x + velocity.x * inSeconds, y: position.y + velocity.y * inSeconds };

  return { distanceNm: round(Math.hypot(closest.x, closest.y), 2), inSeconds: Math.round(inSeconds) };
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

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
