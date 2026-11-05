import type { NearbyPlane } from '@overhead/shared';

const FACING_WITHIN_DEG = 10;
const METERS_PER_FOOT = 0.3048;
const METERS_PER_NM = 1852;

export interface LookUpGuide {
  arrowDeg: number;
  direction: string;
  elevationDeg: number;
  facing: boolean;
}

export function lookUpGuide(plane: NearbyPlane, headingDeg: number): LookUpGuide {
  const arrowDeg = relativeBearing(plane.bearingDeg, headingDeg);
  return {
    arrowDeg,
    direction: describeDirection(arrowDeg),
    elevationDeg: elevationAngle(plane.altitudeFt, plane.distanceNm),
    facing: Math.abs(arrowDeg) < FACING_WITHIN_DEG,
  };
}

export function tapsWhenFacing(wasFacing: boolean, facing: boolean): boolean {
  return facing && !wasFacing;
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
