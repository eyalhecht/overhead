import { describe, expect, it } from 'vitest';
import { pointOnArc, ROUTE_PROGRESS } from './routeArc';

const ARC = { width: 300, rise: 40 };

describe('where the plane sits on the route line', () => {
  it('moves left to right as the pass goes on', () => {
    expect(ROUTE_PROGRESS.approaching).toBeLessThan(ROUTE_PROGRESS.overhead);
    expect(ROUTE_PROGRESS.overhead).toBeLessThan(ROUTE_PROGRESS.passed);
  });

  it('is at the top of the arc, flying level, while the plane is above you', () => {
    const point = pointOnArc(ROUTE_PROGRESS.overhead, ARC);
    expect(point.x).toBeCloseTo(ARC.width / 2);
    expect(point.y).toBeCloseTo(0);
    expect(point.headingDeg).toBeCloseTo(90);
  });

  it('climbs on the left while approaching and descends on the right once passed', () => {
    const before = pointOnArc(ROUTE_PROGRESS.approaching, ARC);
    const after = pointOnArc(ROUTE_PROGRESS.passed, ARC);
    expect(before.x).toBeLessThan(ARC.width / 2);
    expect(before.headingDeg).toBeLessThan(90);
    expect(after.x).toBeGreaterThan(ARC.width / 2);
    expect(after.headingDeg).toBeGreaterThan(90);
  });

  it('starts and ends on the baseline at both edges', () => {
    expect(pointOnArc(0, ARC)).toMatchObject({ x: 0, y: ARC.rise });
    expect(pointOnArc(1, ARC).x).toBeCloseTo(ARC.width);
    expect(pointOnArc(1, ARC).y).toBeCloseTo(ARC.rise);
  });
});
