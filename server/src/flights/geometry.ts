import type { PassStage } from '@overhead/shared';
import { aircraftBuild, isNoticeable, NOTICE } from './perception.js';

export const PASS_RULES = {
  approachLeadSeconds: 10,
  inboundLeadSeconds: 120,
  notice: NOTICE,
};

export type PassRules = typeof PASS_RULES;

const LOOKAHEAD_STEP_SECONDS = 5;
const HOVER_SPEED_KT = 40;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export interface Aircraft {
  id: string;
  flight: string;
  typeCode?: string;
  category?: string;
  altitudeFt: number;
  verticalRateFpm?: number;
  groundSpeedKt: number;
  trackDeg: number;
  distanceNm: number;
  bearingDeg: number;
}

export function passStage(aircraft: Aircraft, rules: PassRules = PASS_RULES): PassStage | null {
  if (aircraft.groundSpeedKt < HOVER_SPEED_KT) return null;

  const inSeconds = secondsUntilNoticeable(aircraft, rules);
  if (inSeconds === undefined) return null;
  if (inSeconds === 0) return 'overhead';
  return inSeconds <= rules.approachLeadSeconds ? 'approaching' : 'inbound';
}

function secondsUntilNoticeable(aircraft: Aircraft, rules: PassRules): number | undefined {
  const build = aircraftBuild(aircraft.typeCode, aircraft.category);
  for (let seconds = 0; seconds <= rules.inboundLeadSeconds; seconds += LOOKAHEAD_STEP_SECONDS) {
    if (isNoticeable({ ...positionIn(aircraft, seconds), build }, rules.notice)) return seconds;
  }
  return undefined;
}

function positionIn(aircraft: Aircraft, seconds: number): Pick<Aircraft, 'distanceNm' | 'altitudeFt'> {
  const position = toVector(aircraft.distanceNm, aircraft.bearingDeg);
  const velocity = toVector(aircraft.groundSpeedKt / SECONDS_PER_HOUR, aircraft.trackDeg);
  const climbFt = ((aircraft.verticalRateFpm ?? 0) * seconds) / SECONDS_PER_MINUTE;
  return {
    distanceNm: Math.hypot(position.x + velocity.x * seconds, position.y + velocity.y * seconds),
    altitudeFt: Math.max(0, aircraft.altitudeFt + climbFt),
  };
}

interface Vector {
  x: number;
  y: number;
}

function toVector(length: number, bearingDeg: number): Vector {
  const radians = (bearingDeg * Math.PI) / 180;
  return { x: length * Math.sin(radians), y: length * Math.cos(radians) };
}
