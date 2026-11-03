// Seeing: an unexpected object gets noticed at about 24-36 arcminutes (FAA AM-14/09), buildings hide the low sky.
// Hearing: noise falls 6 dB per doubling of distance plus air absorption, against a 55 dBA city street.
export const NOTICE = {
  minVisualAngleDeg: 0.5,
  minElevationDeg: 25,
  streetNoiseDb: 55,
};

const METERS_PER_NM = 1852;
const METERS_PER_FT = 0.3048;
const NOISE_REFERENCE_M = 305;
const AIR_ABSORPTION_DB_PER_M = 0.005;

export interface Build {
  sizeM: number;
  noiseDb: number;
}

const BUILDS = {
  light: { sizeM: 11, noiseDb: 70 },
  helicopter: { sizeM: 14, noiseDb: 85 },
  businessJet: { sizeM: 24, noiseDb: 78 },
  regional: { sizeM: 30, noiseDb: 80 },
  airliner: { sizeM: 38, noiseDb: 85 },
  widebody: { sizeM: 62, noiseDb: 90 },
} satisfies Record<string, Build>;

type BuildName = keyof typeof BUILDS;

const BUILD_BY_TYPE: Record<string, BuildName> = Object.fromEntries([
  ...['A332', 'A333', 'A338', 'A339', 'A342', 'A343', 'A345', 'A346', 'A359', 'A35K', 'A388'].map((type) => [
    type,
    'widebody',
  ]),
  ...['B741', 'B742', 'B743', 'B744', 'B748', 'B762', 'B763', 'B764', 'B772', 'B77L', 'B773', 'B77W'].map(
    (type) => [type, 'widebody'],
  ),
  ...['B778', 'B779', 'B788', 'B789', 'B78X', 'C17', 'A400', 'A124', 'A225', 'C5M'].map((type) => [
    type,
    'widebody',
  ]),
  ...['E170', 'E175', 'E190', 'E195', 'E290', 'E295', 'CRJ7', 'CRJ9', 'CRJX', 'AT45', 'AT72', 'AT75'].map(
    (type) => [type, 'regional'],
  ),
  ...['AT76', 'DH8D'].map((type) => [type, 'regional']),
  ...['C152', 'C172', 'C182', 'C206', 'P28A', 'PA34', 'SR20', 'SR22', 'DA40', 'DA42', 'BE36'].map((type) => [
    type,
    'light',
  ]),
  ...['R22', 'R44', 'R66', 'EC35', 'EC45', 'H135', 'H145', 'AS50', 'B407', 'S76', 'H60'].map((type) => [
    type,
    'helicopter',
  ]),
]);

const BUILD_BY_CATEGORY: Record<string, BuildName> = {
  A1: 'light',
  A2: 'businessJet',
  A3: 'airliner',
  A4: 'airliner',
  A5: 'widebody',
  A7: 'helicopter',
};

export function aircraftBuild(typeCode?: string, category?: string): Build {
  const name =
    (typeCode && BUILD_BY_TYPE[typeCode]) || (category && BUILD_BY_CATEGORY[category]) || 'airliner';
  return BUILDS[name];
}

export interface Sighting {
  distanceNm: number;
  altitudeFt: number;
  build: Build;
}

export function isNoticeable({ distanceNm, altitudeFt, build }: Sighting, notice = NOTICE): boolean {
  const groundM = distanceNm * METERS_PER_NM;
  const heightM = Math.max(0, altitudeFt) * METERS_PER_FT;
  const slantM = Math.hypot(groundM, heightM);
  const elevationDeg = toDegrees(Math.atan2(heightM, groundM));

  const seen =
    elevationDeg >= notice.minElevationDeg && toDegrees(build.sizeM / slantM) >= notice.minVisualAngleDeg;
  const heard = loudnessDb(build, slantM) >= notice.streetNoiseDb;
  return seen || heard;
}

function loudnessDb({ noiseDb }: Build, slantM: number): number {
  const distanceM = Math.max(slantM, NOISE_REFERENCE_M);
  return (
    noiseDb -
    20 * Math.log10(distanceM / NOISE_REFERENCE_M) -
    AIR_ABSORPTION_DB_PER_M * (distanceM - NOISE_REFERENCE_M)
  );
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
