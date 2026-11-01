import type { GeoPoint, NearbyPlane } from '@overhead/shared';
import { aircraftName, rareAircraftName } from './aircraft.js';
import { isOverhead, secondsUntilExit } from './geometry.js';
import type { PositionSource } from './positions.js';
import type { RouteSource } from './routes.js';

const SEARCH_RADIUS_NM = 3;

export interface Sky {
  planesAbove(point: GeoPoint): Promise<NearbyPlane[]>;
}

export function createSky(positions: PositionSource, routes: RouteSource): Sky {
  return {
    async planesAbove(point) {
      const aircraft = await positions.aircraftNear(point, SEARCH_RADIUS_NM);
      const overhead = aircraft.filter(isOverhead).sort((a, b) => a.distanceNm - b.distanceNm);

      return Promise.all(
        overhead.map(async (plane) => ({
          id: plane.id,
          flight: plane.flight,
          aircraft: aircraftName(plane.typeCode),
          rare: rareAircraftName(plane.typeCode),
          altitudeFt: plane.altitudeFt,
          trackDeg: plane.trackDeg,
          distanceNm: plane.distanceNm,
          bearingDeg: plane.bearingDeg,
          secondsLeft: secondsUntilExit(plane),
          route: await routes.routeFor(plane.flight),
        })),
      );
    },
  };
}
