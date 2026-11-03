import type { GeoPoint, NearbyPlane, PassStage } from '@overhead/shared';
import { aircraftName } from './aircraft.js';
import { airlineName } from './airlines.js';
import { passStage, type Aircraft } from './geometry.js';
import type { PositionSource } from './positions.js';
import type { RouteSource } from './routes.js';

const SEARCH_RADIUS_NM = 15;
const STAGE_ORDER: PassStage[] = ['overhead', 'approaching', 'inbound'];

export interface Sky {
  planesAbove(point: GeoPoint): Promise<NearbyPlane[]>;
}

type PassingAircraft = Aircraft & { stage: PassStage };

export function createSky(
  positions: PositionSource,
  routes: RouteSource,
  stageOf: (aircraft: Aircraft) => PassStage | null = passStage,
): Sky {
  return {
    async planesAbove(point) {
      const aircraft = await positions.aircraftNear(point, SEARCH_RADIUS_NM);
      const passing = aircraft
        .map((plane) => ({ ...plane, stage: stageOf(plane) }))
        .filter((plane): plane is PassingAircraft => plane.stage !== null)
        .sort(byStageThenDistance);

      return Promise.all(
        passing.map(async (plane) => ({
          id: plane.id,
          flight: plane.flight,
          airline: airlineName(plane.flight),
          aircraft: aircraftName(plane.typeCode),
          altitudeFt: plane.altitudeFt,
          trackDeg: plane.trackDeg,
          distanceNm: plane.distanceNm,
          bearingDeg: plane.bearingDeg,
          stage: plane.stage,
          route: await routes.routeFor(plane.flight),
        })),
      );
    },
  };
}

function byStageThenDistance(a: PassingAircraft, b: PassingAircraft): number {
  return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.distanceNm - b.distanceNm;
}
