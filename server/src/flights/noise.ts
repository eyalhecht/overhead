import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closestApproach, type Aircraft } from './geometry.js';

// The noise tables come from EASA's legacy ANP 2.3 database, downloaded at deploy and never stored in this repo.
// Equations: ECAC Doc 29, 5th edition, Volume 2. Reasoning and sources: docs/research/hearing-planes.md.

const NPD_LOG_DISTANCES = [200, 400, 630, 1000, 2000, 4000, 6300, 10_000, 16_000, 25_000].map(Math.log10);
const METERS_PER_FT = 0.3048;
const METERS_PER_NM = 1852;
const GROUND_ELEVATION_M = 30;
const CLIMBING_FPM = 300;
const APPROACH_BELOW_FT = 4000;
const SLOW_FOR_FLAPS_KT = 210;

type Mode = 'A' | 'D';
type Installation = 'Wing' | 'Fuselage' | 'Prop';

interface NpdCurve {
  power: number;
  levels: number[];
}

interface Rating {
  e: number;
  f: number;
  ga: number;
  gb: number;
}

interface NoiseProfile {
  engines: number;
  installation: Installation;
  departureWeightLb: number;
  approachWeightLb: number;
  staticThrustLb: number;
  powerInPercent: boolean;
  cleanDragRatio: number;
  landingDragRatio: number;
  maxClimb?: Rating;
  maxTakeoff?: Rating;
  curves: Record<Mode, NpdCurve[]>;
}

// ICAO type code -> ANP proxy and its dB correction for departure and approach, from EASA's
// "ANP Aircraft Substitutions" table (by ICAO code). Where the engine is unknown, the louder variant is used.
const PROXIES: Record<string, [proxy: string, departureDb: number, approachDb: number]> = {
  A19N: ['A319-131', 0, 0],
  A20N: ['A320-232', -3.5, -2],
  A21N: ['A321-232', -3.7, -0.7],
  A319: ['A319-131', 2, 0.3],
  A320: ['A320-232', 2.3, 2.2],
  A321: ['A321-232', 3.5, 1.4],
  A332: ['A330-301', 2, 0.7],
  A333: ['A330-301', 2, 0.8],
  A339: ['A330-301', 2, 0.8],
  A343: ['A340-211', 1.3, 0.1],
  A359: ['A350-941', 0.2, 0],
  A35K: ['A350-941', 3, 0.2],
  A388: ['A380-861', 0.3, 0.1],
  B712: ['717200', 0.3, 0.5],
  B733: ['737300', 0.4, 0.2],
  B734: ['737400', 0, 0],
  B737: ['737700', 1.5, 0.4],
  B738: ['737800', 0.6, 0.4],
  B739: ['737800', 1.2, 0.2],
  B38M: ['7378MAX', 0.2, 0],
  B39M: ['7378MAX', 0.2, 0],
  B744: ['747400', 0, 0.6],
  B748: ['7478', 0, 0.6],
  B752: ['757PW', 4.3, 1.1],
  B753: ['757300', 1.1, 2.1],
  B763: ['767300', 1.2, 3.3],
  B764: ['767400', 0, 0],
  B772: ['777200', 2.4, 1.3],
  B77L: ['7773ER', -0.2, -0.2],
  B77W: ['7773ER', 0, 0],
  B788: ['7878R', 3.1, 4.7],
  B789: ['7878R', 3.2, 2.8],
  BCS1: ['737500', -3.5, -5.9],
  BCS3: ['737700', -4.6, -3.5],
  CRJ9: ['CRJ9-ER', 1, 0.8],
  DH8D: ['DHC830', -1.5, 0],
  E170: ['EMB170', 0.6, 0.2],
  E175: ['EMB175', 0, 0],
  E190: ['EMB190', 0, 0],
  E195: ['EMB195', 0, 0],
  E290: ['EMB190', 0, 0],
  E295: ['EMB195', 0, 0],
  C172: ['CNA172', 0, 0],
};

export interface NoiseModel {
  peakDb(aircraft: Aircraft): number | undefined;
}

export function loadNoiseModel(directory: string): NoiseModel | undefined {
  const file = (name: string) => join(directory, `ANP2.3_${name}.csv`);
  if (!existsSync(file('NPD_data'))) return undefined;
  const rows = (name: string) =>
    readFileSync(file(name), 'utf8')
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(';'));
  return createNoiseModel({
    aircraft: rows('Aircraft'),
    npd: rows('NPD_data'),
    engines: rows('Jet_engine_coefficients'),
    aerodynamics: rows('Aerodynamic_coefficients'),
    weights: rows('Default_weights'),
  });
}

export interface NoiseTables {
  aircraft: string[][];
  npd: string[][];
  engines: string[][];
  aerodynamics: string[][];
  weights: string[][];
}

export function createNoiseModel(tables: NoiseTables): NoiseModel {
  const profiles = new Map<string, NoiseProfile>();
  for (const [proxy] of Object.values(PROXIES)) {
    const profile = buildProfile(proxy, tables);
    if (profile) profiles.set(proxy, profile);
  }

  return {
    peakDb(aircraft) {
      const entry = aircraft.typeCode ? PROXIES[aircraft.typeCode] : undefined;
      const profile = entry && profiles.get(entry[0]);
      if (!entry || !profile) return undefined;

      const { mode, power } = thrust(profile, aircraft);
      const { distanceNm, inSeconds } = closestApproach(aircraft);
      const climbFt = ((aircraft.verticalRateFpm ?? 0) * inSeconds) / 60;
      const groundM = distanceNm * METERS_PER_NM;
      const heightM = Math.max(0, (aircraft.altitudeFt + climbFt) * METERS_PER_FT - GROUND_ELEVATION_M);
      const slantM = Math.hypot(groundM, heightM);
      const elevationDeg = toDegrees(Math.atan2(heightM, groundM));

      const level =
        npdLevel(profile.curves[mode], power, slantM / METERS_PER_FT) +
        installationDb(profile.installation, elevationDeg) -
        lateralAttenuationDb(elevationDeg, groundM) +
        (mode === 'D' ? entry[1] : entry[2]);
      return Math.round(level * 10) / 10;
    },
  };
}

function buildProfile(proxy: string, tables: NoiseTables): NoiseProfile | undefined {
  const row = tables.aircraft.find(([id]) => id === proxy);
  if (!row) return undefined;
  const npdId = row[11];
  const curvesFor = (mode: Mode) =>
    tables.npd
      .filter(([id, metric, opMode]) => id === npdId && metric === 'LAmax' && opMode === mode)
      .map((cells) => ({ power: Number(cells[3]), levels: cells.slice(4, 14).map(Number) }))
      .sort((a, b) => a.power - b.power);
  const rating = (name: string): Rating | undefined => {
    const cells = tables.engines.find(([id, rated]) => id === proxy && rated === name);
    return (
      cells && {
        e: Number(cells[2]),
        f: Number(cells[3]),
        ga: Number(cells[4]) || 0,
        gb: Number(cells[5]) || 0,
      }
    );
  };
  const dragRatios = (opType: Mode) =>
    tables.aerodynamics.filter(([id, op]) => id === proxy && op === opType).map((cells) => Number(cells[6]));
  const stageTwoWeight = tables.weights.find(([id, stage]) => id === proxy && stage === '2');
  const curves = { A: curvesFor('A'), D: curvesFor('D') };
  if (curves.A.length === 0 || curves.D.length === 0) return undefined;

  return {
    engines: Number(row[3]),
    installation: row[15] as Installation,
    departureWeightLb: Number(stageTwoWeight?.[2] ?? row[6]),
    approachWeightLb: 0.9 * Number(row[7]),
    staticThrustLb: Number(row[9]),
    powerInPercent: (row[12] ?? '').includes('%'),
    cleanDragRatio: Math.min(...dragRatios('D'), 0.08),
    landingDragRatio: Math.max(...dragRatios('A'), 0.1),
    maxClimb: rating('MaxClimb'),
    maxTakeoff: rating('MaxTakeoff'),
    curves,
  };
}

// Doc 29 force balance: thrust per engine from the climb angle and the drag of the likely flap setting.
function thrust(profile: NoiseProfile, aircraft: Aircraft): { mode: Mode; power: number } {
  const altitudeFt = Math.max(0, aircraft.altitudeFt);
  const rateFpm = aircraft.verticalRateFpm ?? 0;
  const pressureRatio = (1 - 6.8756e-6 * altitudeFt) ** 5.2559;
  const climbSine = clamp(rateFpm / (Math.max(aircraft.groundSpeedKt, 60) * 101.27), -0.2, 0.3);
  const perEngine = (weightLb: number, force: number) =>
    Math.max(1, ((weightLb / pressureRatio) * force) / profile.engines);
  const rated = (rating: Rating | undefined) =>
    rating &&
    rating.e + rating.f * aircraft.groundSpeedKt + rating.ga * altitudeFt + rating.gb * altitudeFt ** 2;

  let mode: Mode;
  let pounds: number;
  if (rateFpm > CLIMBING_FPM) {
    mode = 'D';
    pounds = perEngine(profile.departureWeightLb, climbSine / 0.95 + profile.cleanDragRatio);
    const ceiling = rated(profile.maxTakeoff);
    const floor = rated(profile.maxClimb);
    if (ceiling) pounds = Math.min(pounds, ceiling);
    if (floor) pounds = Math.max(pounds, 0.5 * floor);
  } else if (rateFpm < -CLIMBING_FPM || altitudeFt < APPROACH_BELOW_FT) {
    mode = 'A';
    pounds = perEngine(profile.approachWeightLb, profile.landingDragRatio - Math.abs(climbSine) / 1.03);
  } else {
    mode = aircraft.groundSpeedKt < SLOW_FOR_FLAPS_KT ? 'A' : 'D';
    pounds = perEngine(profile.approachWeightLb, profile.cleanDragRatio);
  }
  return { mode, power: profile.powerInPercent ? (100 * pounds) / profile.staticThrustLb : pounds };
}

// Doc 29 eqs. 4-3 and 4-4: linear in power (held at the table's edges), linear in log distance.
function npdLevel(curves: NpdCurve[], power: number, distanceFt: number): number {
  const logDistance = Math.log10(Math.max(distanceFt, 100));
  const levels = curves.map((curve) => interpolate(NPD_LOG_DISTANCES, curve.levels, logDistance));
  const powers = curves.map((curve) => curve.power);
  return interpolate(powers, levels, clamp(power, Math.min(...powers), Math.max(...powers)));
}

// Linear between the surrounding points, extended from the nearest two outside the range.
function interpolate(xs: number[], ys: number[], x: number): number {
  const found = xs.findIndex((value) => value >= x);
  const upper = Math.min(Math.max(found === -1 ? xs.length - 1 : found, 1), xs.length - 1);
  const [x0, x1, y0, y1] = [xs[upper - 1], xs[upper], ys[upper - 1], ys[upper]];
  if (x0 === undefined || x1 === undefined || y0 === undefined || y1 === undefined || x0 === x1)
    return ys[0] ?? 0;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

// Doc 29 eq. 4-15: engine installation directivity.
function installationDb(installation: Installation, elevationDeg: number): number {
  if (installation === 'Prop') return 0;
  const [a, b, c] = installation === 'Wing' ? [0.0039, 0.062, 0.8786] : [0.1225, 0.329, 1];
  const phi = (Math.max(0, elevationDeg) * Math.PI) / 180;
  return (
    10 *
    Math.log10(
      (a * Math.cos(phi) ** 2 + Math.sin(phi) ** 2) ** b /
        (c * Math.sin(2 * phi) ** 2 + Math.cos(2 * phi) ** 2),
    )
  );
}

// Doc 29 eqs. 4-18 and 4-19: extra ground and lateral attenuation for low passes.
function lateralAttenuationDb(elevationDeg: number, groundM: number): number {
  if (elevationDeg > 50) return 0;
  const distanceFactor = groundM <= 914 ? 1.089 * (1 - Math.exp(-0.00274 * groundM)) : 1;
  return distanceFactor * (1.137 - 0.0229 * elevationDeg + 9.72 * Math.exp(-0.142 * elevationDeg));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
