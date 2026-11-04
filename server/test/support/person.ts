import type { GeoPoint } from '@overhead/shared';

// An independent judge of what a person on a city street notices. It deliberately shares no code or
// numbers with src/flights/perception.ts, so the server is scored against a second opinion.
//
// Seeing follows Andrews' visual acquisition model (MIT Lincoln Laboratory ATC-151, 1991): the chance of
// noticing each second is beta x (visual area / range^2). A searching pilot has beta of about 17,000 per
// steradian-second; someone walking down a street is not searching, so we use a tenth of that.
// Hearing compares each type's certified noise, spread over distance, with street noise.

export interface PlaneInSky {
  id: string;
  typeCode?: string;
  category?: string;
  lat: number;
  lon: number;
  altitudeFt: number;
  trackDeg: number;
}

interface Shape {
  spanM: number;
  lengthM: number;
  wingAreaM2: number;
  fuselageM: number;
  loudnessAt1000FtDb: number;
}

const SHAPES: Record<string, Shape> = {
  A319: { spanM: 34.1, lengthM: 33.8, wingAreaM2: 122.6, fuselageM: 3.95, loudnessAt1000FtDb: 79 },
  A320: { spanM: 35.8, lengthM: 37.6, wingAreaM2: 122.6, fuselageM: 3.95, loudnessAt1000FtDb: 80 },
  A20N: { spanM: 35.8, lengthM: 37.6, wingAreaM2: 122.6, fuselageM: 3.95, loudnessAt1000FtDb: 77 },
  A321: { spanM: 35.8, lengthM: 44.5, wingAreaM2: 122.4, fuselageM: 3.95, loudnessAt1000FtDb: 82 },
  A21N: { spanM: 35.8, lengthM: 44.5, wingAreaM2: 122.4, fuselageM: 3.95, loudnessAt1000FtDb: 79 },
  B738: { spanM: 35.8, lengthM: 39.5, wingAreaM2: 124.6, fuselageM: 3.76, loudnessAt1000FtDb: 81 },
  B38M: { spanM: 35.9, lengthM: 39.5, wingAreaM2: 127, fuselageM: 3.76, loudnessAt1000FtDb: 78 },
  B739: { spanM: 35.8, lengthM: 42.1, wingAreaM2: 124.6, fuselageM: 3.76, loudnessAt1000FtDb: 82 },
  BCS3: { spanM: 35.1, lengthM: 38.7, wingAreaM2: 112.3, fuselageM: 3.7, loudnessAt1000FtDb: 76 },
  E190: { spanM: 28.7, lengthM: 36.2, wingAreaM2: 92.5, fuselageM: 3.0, loudnessAt1000FtDb: 78 },
  E195: { spanM: 28.7, lengthM: 38.7, wingAreaM2: 92.5, fuselageM: 3.0, loudnessAt1000FtDb: 78 },
  CRJ9: { spanM: 24.9, lengthM: 36.2, wingAreaM2: 71.1, fuselageM: 2.7, loudnessAt1000FtDb: 78 },
  AT76: { spanM: 27.1, lengthM: 27.2, wingAreaM2: 61, fuselageM: 2.6, loudnessAt1000FtDb: 74 },
  DH8D: { spanM: 28.4, lengthM: 32.8, wingAreaM2: 63.1, fuselageM: 2.7, loudnessAt1000FtDb: 75 },
  A332: { spanM: 60.3, lengthM: 58.8, wingAreaM2: 361.6, fuselageM: 5.64, loudnessAt1000FtDb: 86 },
  A333: { spanM: 60.3, lengthM: 63.7, wingAreaM2: 361.6, fuselageM: 5.64, loudnessAt1000FtDb: 86 },
  A359: { spanM: 64.8, lengthM: 66.8, wingAreaM2: 442, fuselageM: 5.96, loudnessAt1000FtDb: 83 },
  B763: { spanM: 47.6, lengthM: 54.9, wingAreaM2: 283.3, fuselageM: 5.03, loudnessAt1000FtDb: 85 },
  B788: { spanM: 60.1, lengthM: 56.7, wingAreaM2: 360, fuselageM: 5.77, loudnessAt1000FtDb: 82 },
  B789: { spanM: 60.1, lengthM: 62.8, wingAreaM2: 377, fuselageM: 5.77, loudnessAt1000FtDb: 83 },
  B77W: { spanM: 64.8, lengthM: 73.9, wingAreaM2: 436.8, fuselageM: 6.2, loudnessAt1000FtDb: 88 },
  B744: { spanM: 64.4, lengthM: 70.7, wingAreaM2: 525, fuselageM: 6.5, loudnessAt1000FtDb: 92 },
  GLF4: { spanM: 23.7, lengthM: 26.9, wingAreaM2: 88.3, fuselageM: 2.4, loudnessAt1000FtDb: 78 },
  H25B: { spanM: 15.7, lengthM: 15.6, wingAreaM2: 34.8, fuselageM: 1.9, loudnessAt1000FtDb: 77 },
  C172: { spanM: 11, lengthM: 8.3, wingAreaM2: 16.2, fuselageM: 1.1, loudnessAt1000FtDb: 66 },
  R44: { spanM: 10.1, lengthM: 11.7, wingAreaM2: 8, fuselageM: 1.3, loudnessAt1000FtDb: 76 },
};

const SHAPE_BY_CATEGORY: Record<string, string> = {
  A1: 'C172',
  A2: 'H25B',
  A3: 'A320',
  A4: 'B763',
  A5: 'B789',
  A7: 'R44',
};

const PEDESTRIAN_BETA = 1700;
const NOTICE_HAZARD = Math.LN2;
// The user's rule: a far-off dot you would barely notice is not worth a card. A plane counts once it looks
// at least 0.3 degrees big, and stops counting below 0.2 degrees.
const WORTH_NOTICING_DEG = 0.3;
const LOSE_SIGHT_DEG = 0.2;
const STREET_NOISE_DB = 55;
const HEARD_BELOW_STREET_NOISE_DB = 3;
const AIR_ABSORPTION_DB_PER_KM = 4.7;
const EARTH_RADIUS_M = 6_371_000;
const FEET_TO_M = 0.3048;

export interface Awareness {
  seen: boolean;
  heard: boolean;
}

export class Person {
  private readonly hazard = new Map<string, number>();
  private readonly spotted = new Set<string>();

  constructor(
    readonly at: GeoPoint,
    private readonly rooftopDeg: (azimuthDeg: number) => number,
  ) {}

  // Advances the person by dt seconds and says which planes they are aware of right now.
  look(planes: PlaneInSky[], dtSeconds: number): Map<string, Awareness> {
    const aware = new Map<string, Awareness>();
    for (const plane of planes) {
      const shape = shapeOf(plane);
      const { rangeM, azimuthDeg, elevationDeg, lineOfSight } = this.locate(plane);
      const inOpenSky = elevationDeg > this.rooftopDeg(azimuthDeg);
      const heard = loudnessDb(shape, rangeM) >= STREET_NOISE_DB - HEARD_BELOW_STREET_NOISE_DB;

      if (inOpenSky) {
        const solidAngle = visualAreaM2(shape, lineOfSight, plane.trackDeg) / rangeM ** 2;
        const attention = heard ? 10 : 1;
        this.hazard.set(
          plane.id,
          (this.hazard.get(plane.id) ?? 0) + PEDESTRIAN_BETA * attention * solidAngle * dtSeconds,
        );
        const looksBig = degrees(Math.max(shape.spanM, shape.lengthM) / rangeM) >= WORTH_NOTICING_DEG;
        if (looksBig && (this.hazard.get(plane.id) ?? 0) >= NOTICE_HAZARD) this.spotted.add(plane.id);
      }

      const bigEnough = degrees(Math.max(shape.spanM, shape.lengthM) / rangeM) >= LOSE_SIGHT_DEG;
      const seen = this.spotted.has(plane.id) && inOpenSky && bigEnough;
      if (!seen) this.spotted.delete(plane.id);
      if (!seen && !inOpenSky) this.hazard.delete(plane.id);
      if (seen || heard) aware.set(plane.id, { seen, heard });
    }
    return aware;
  }

  private locate(plane: PlaneInSky) {
    const me = toEcef(this.at.lat, this.at.lon, 0);
    const it = toEcef(plane.lat, plane.lon, plane.altitudeFt * FEET_TO_M);
    const delta = { x: it.x - me.x, y: it.y - me.y, z: it.z - me.z };
    const lat = radians(this.at.lat);
    const lon = radians(this.at.lon);
    const east = -Math.sin(lon) * delta.x + Math.cos(lon) * delta.y;
    const north =
      -Math.sin(lat) * Math.cos(lon) * delta.x -
      Math.sin(lat) * Math.sin(lon) * delta.y +
      Math.cos(lat) * delta.z;
    const up =
      Math.cos(lat) * Math.cos(lon) * delta.x +
      Math.cos(lat) * Math.sin(lon) * delta.y +
      Math.sin(lat) * delta.z;
    const rangeM = Math.hypot(east, north, up);
    return {
      rangeM,
      azimuthDeg: (degrees(Math.atan2(east, north)) + 360) % 360,
      elevationDeg: degrees(Math.asin(up / rangeM)),
      lineOfSight: { east: east / rangeM, north: north / rangeM, up: up / rangeM },
    };
  }
}

function shapeOf({ typeCode, category }: PlaneInSky): Shape {
  const known = typeCode && SHAPES[typeCode];
  if (known) return known;
  const stand_in = (category && SHAPE_BY_CATEGORY[category]) || 'A320';
  return SHAPES[stand_in] as Shape;
}

// Andrews' shielding approximation: the largest projected face plus a third of the others.
function visualAreaM2(
  shape: Shape,
  sight: { east: number; north: number; up: number },
  trackDeg: number,
): number {
  const along = { east: Math.sin(radians(trackDeg)), north: Math.cos(radians(trackDeg)) };
  const nose = Math.abs(sight.east * along.east + sight.north * along.north);
  const side = Math.sqrt(Math.max(0, 1 - nose ** 2 - sight.up ** 2));
  const top = shape.wingAreaM2 * 1.25 + shape.lengthM * shape.fuselageM * 0.8;
  const flank = shape.lengthM * shape.fuselageM + shape.wingAreaM2 * 0.15;
  const front = shape.fuselageM ** 2 + shape.spanM * 0.6;
  const faces = [top * Math.abs(sight.up), flank * side, front * nose].sort((a, b) => b - a);
  return (faces[0] ?? 0) + ((faces[1] ?? 0) + (faces[2] ?? 0)) / 3;
}

function loudnessDb(shape: Shape, rangeM: number): number {
  const referenceM = 1000 * FEET_TO_M;
  const distanceM = Math.max(rangeM, referenceM);
  const spreading = 20 * Math.log10(distanceM / referenceM);
  const absorption = (AIR_ABSORPTION_DB_PER_KM * (distanceM - referenceM)) / 1000;
  return shape.loudnessAt1000FtDb - spreading - absorption;
}

function toEcef(latDeg: number, lonDeg: number, heightM: number) {
  const r = EARTH_RADIUS_M + heightM;
  const lat = radians(latDeg);
  const lon = radians(lonDeg);
  return { x: r * Math.cos(lat) * Math.cos(lon), y: r * Math.cos(lat) * Math.sin(lon), z: r * Math.sin(lat) };
}

const radians = (deg: number) => (deg * Math.PI) / 180;
const degrees = (rad: number) => (rad * 180) / Math.PI;

// A street in Ramat Gan: rooftops between 12 and 35 degrees, different in each direction.
export function cityStreet(seed: number): (azimuthDeg: number) => number {
  const random = mulberry32(seed);
  const sectors = Array.from({ length: 8 }, () => 12 + random() * 23);
  return (azimuthDeg) => sectors[Math.floor(azimuthDeg / 45) % 8] ?? 20;
}

export const openPark = () => 5;

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
