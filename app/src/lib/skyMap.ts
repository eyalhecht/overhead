import { isOnCard } from '@overhead/shared/rules';
import type { NearbyPlane } from '@overhead/shared';
import { KM_PER_NM } from './format';

const RING_COUNT = 3;
const WIDEST_RING_STEP_KM = 10;
const RING_STEPS_KM = [1, 2, 5, WIDEST_RING_STEP_KM];

export const MAP = {
  width: 300,
  height: 200,
  center: { x: 150, y: 100 },
  ringSpacingPx: 32,
  rings: Array.from({ length: RING_COUNT }, (_, index) => index + 1),
} as const;

export interface PlacedPlane {
  x: number;
  y: number;
  rotation: number;
}

export function ringStepKm(farthestKm: number): number {
  return RING_STEPS_KM.find((step) => step * RING_COUNT >= farthestKm) ?? WIDEST_RING_STEP_KM;
}

export interface Zoom {
  stepKm: number;
  shown: NearbyPlane[];
}

export function zoomFor(planes: NearbyPlane[]): Zoom {
  const distanceKm = (plane: NearbyPlane) => plane.distanceNm * KM_PER_NM;
  const onTheCard = planes.filter(isOnCard);
  const stepKm = ringStepKm(Math.max(0, ...onTheCard.map(distanceKm)));
  return { stepKm, shown: planes.filter((plane) => distanceKm(plane) <= stepKm * RING_COUNT) };
}

export function placePlane(plane: NearbyPlane, headingDeg: number, stepKm: number): PlacedPlane {
  const distancePx = ((plane.distanceNm * KM_PER_NM) / stepKm) * MAP.ringSpacingPx;
  return {
    ...pointAt(plane.bearingDeg - headingDeg, distancePx),
    rotation: normalize(plane.trackDeg - headingDeg),
  };
}

export function northLabelPosition(headingDeg: number): { x: number; y: number } {
  return pointAt(-headingDeg, RING_COUNT * MAP.ringSpacingPx);
}

function pointAt(screenBearingDeg: number, distancePx: number): { x: number; y: number } {
  const radians = (screenBearingDeg * Math.PI) / 180;
  return {
    x: MAP.center.x + distancePx * Math.sin(radians),
    y: MAP.center.y - distancePx * Math.cos(radians),
  };
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
