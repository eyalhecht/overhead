import type { CardStage } from '@overhead/shared';

export interface Arc {
  width: number;
  rise: number;
}

export interface ArcPoint {
  x: number;
  y: number;
  headingDeg: number;
}

export const ROUTE_PROGRESS: Record<CardStage, number> = {
  approaching: 0.32,
  overhead: 0.5,
  passed: 0.78,
};

export function arcPath({ width, rise }: Arc): string {
  return `M0 ${rise} Q${width / 2} ${-rise} ${width} ${rise}`;
}

export function pointOnArc(progress: number, { width, rise }: Arc): ArcPoint {
  const climb = 1 - 2 * progress;
  const headingDeg = (Math.atan2(width, 4 * rise * climb) * 180) / Math.PI;
  return { x: width * progress, y: rise * climb * climb, headingDeg };
}
