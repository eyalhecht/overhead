import type { GeoPoint, NearbyPlane, PassStage } from '@overhead/shared';
import { aircraftName } from './aircraft.js';
import { airlineName } from './airlines.js';
import { heardStage, passStage, type Aircraft } from './geometry.js';
import type { NoiseModel } from './noise.js';
import type { PositionSource } from './positions.js';
import type { RouteSource } from './routes.js';

const SEARCH_RADIUS_NM = 10;
const STAGE_ORDER: PassStage[] = ['overhead', 'approaching', 'inbound'];

export interface Sky {
  planesAbove(point: GeoPoint): Promise<NearbyPlane[]>;
}

type PassingAircraft = Aircraft & { stage: PassStage; heardDb?: number };

export function createSky(positions: PositionSource, routes: RouteSource, noise?: NoiseModel): Sky {
  return {
    async planesAbove(point) {
      const aircraft = await positions.aircraftNear(point, SEARCH_RADIUS_NM);
      const passing = aircraft
        .map((plane) => withStage(plane, noise))
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
          ...(plane.heardDb !== undefined && { heardDb: plane.heardDb }),
        })),
      );
    },
  };
}

function withStage(
  plane: Aircraft,
  noise?: NoiseModel,
): Aircraft & { stage: PassStage | null; heardDb?: number } {
  const stage = passStage(plane);
  if (stage || !noise) return { ...plane, stage };
  const heardDb = noise.peakDb(plane);
  return { ...plane, stage: heardStage(plane, heardDb), heardDb };
}

function byStageThenDistance(a: PassingAircraft, b: PassingAircraft): number {
  return STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.distanceNm - b.distanceNm;
}
