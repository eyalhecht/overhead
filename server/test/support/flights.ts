import type { GeoPoint } from '@overhead/shared';
import type { RecordedPlane, Snapshot } from './replay.js';

const EARTH_RADIUS_KM = 6371;
const KM_PER_NM = 1.852;
const TICK_SECONDS = 5;

export interface Flight {
  flight: string;
  typeCode?: string;
  category?: string;
  altitudeFt: number;
  verticalRateFpm?: number;
  speedKt?: number;
  headingDeg?: number;
  // How far to the side of the person the straight path passes, and when.
  sideKm?: number;
  closestAtSeconds?: number;
  gapSeconds?: [number, number];
  turnAwayAtSeconds?: number;
}

export function simulate(at: GeoPoint, flights: Flight[], durationSeconds: number): Snapshot[] {
  const start = Date.UTC(2026, 10, 3, 12);
  const snapshots: Snapshot[] = [];
  for (let second = 0; second <= durationSeconds; second += TICK_SECONDS) {
    const planes = flights.flatMap((flight) => {
      const [gapFrom, gapTo] = flight.gapSeconds ?? [Infinity, Infinity];
      if (second >= gapFrom && second < gapTo) return [];
      return [positionAt(at, flight, second)];
    });
    snapshots.push({ at: start + second * 1000, planes });
  }
  return snapshots;
}

function positionAt(at: GeoPoint, flight: Flight, second: number): RecordedPlane {
  const speedKmPerSecond = ((flight.speedKt ?? 180) * KM_PER_NM) / 3600;
  const heading = flight.headingDeg ?? 90;
  const fromClosest = second - (flight.closestAtSeconds ?? 120);
  const turnedFor =
    flight.turnAwayAtSeconds === undefined ? 0 : Math.max(0, second - flight.turnAwayAtSeconds);
  const straightFor = fromClosest - turnedFor;

  const along = toRadians(heading);
  const across = toRadians(heading - 90);
  const away = toRadians(heading - 90);
  let east = straightFor * speedKmPerSecond * Math.sin(along) + (flight.sideKm ?? 0) * Math.sin(across);
  let north = straightFor * speedKmPerSecond * Math.cos(along) + (flight.sideKm ?? 0) * Math.cos(across);
  east += turnedFor * speedKmPerSecond * Math.sin(away);
  north += turnedFor * speedKmPerSecond * Math.cos(away);

  const altitude = flight.altitudeFt + ((flight.verticalRateFpm ?? 0) * fromClosest) / 60;
  return {
    hex: flight.flight.toLowerCase(),
    flight: flight.flight,
    type: flight.typeCode,
    cat: flight.category,
    alt: Math.max(0, Math.round(altitude)),
    gs: flight.speedKt ?? 180,
    track: turnedFor > 0 ? (heading + 270) % 360 : heading,
    rate: flight.verticalRateFpm ?? 0,
    lat: at.lat + toDegrees(north / EARTH_RADIUS_KM),
    lon: at.lon + toDegrees(east / (EARTH_RADIUS_KM * Math.cos(toRadians(at.lat)))),
  };
}

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const toDegrees = (rad: number) => (rad * 180) / Math.PI;
