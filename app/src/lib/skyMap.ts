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

export const PLANE_ICON = {
  size: 24,
  nose: [21, 3],
  noseDeg: 45,
  path: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
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
  const onTheCard = planes.filter(({ stage }) => stage !== 'inbound');
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
