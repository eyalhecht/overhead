import type { NearbyPlane } from '@overhead/shared';
import { describeDirection, elevationAngle, relativeBearing } from './format';

const FACING_WITHIN_DEG = 10;
const LOW_BELOW_DEG = 20;
const HIGH_FROM_DEG = 60;

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

export function elevationHint(elevationDeg: number): string {
  if (elevationDeg < LOW_BELOW_DEG) return 'Look low, just above the horizon';
  if (elevationDeg < HIGH_FROM_DEG) return 'Look about halfway up the sky';
  return 'Look almost straight up';
}
