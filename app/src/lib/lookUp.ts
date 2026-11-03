import type { NearbyPlane } from '@overhead/shared';
import { describeDirection, elevationAngle, relativeBearing } from './format';

const FACING_WITHIN_DEG = 10;

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
