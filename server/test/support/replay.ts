import type { GeoPoint, PassStage } from '@overhead/shared';
import { vi } from 'vitest';
import { createWatcher } from '../../src/activity/watcher.js';
import type { Aircraft } from '../../src/flights/geometry.js';
import { passStage } from '../../src/flights/geometry.js';
import { createSky } from '../../src/flights/sky.js';
import { createUserStore, type User } from '../../src/users.js';
import { FakePush, registerRequest } from '../fakes.js';
import { Person, type PlaneInSky } from './person.js';

export interface RecordedPlane {
  hex: string;
  flight: string;
  type?: string;
  cat?: string;
  alt: number | string;
  geom?: number;
  gs?: number;
  track?: number;
  rate?: number;
  lat: number;
  lon: number;
}

export interface Snapshot {
  at: number;
  planes: RecordedPlane[];
}

export interface Observer {
  name: string;
  at: GeoPoint;
  rooftopDeg: (azimuthDeg: number) => number;
}

export interface Moment {
  at: number;
  card: boolean;
  stage?: string;
  listed: string[];
  aware: string[];
}

export interface Scorecard {
  awareSeconds: number;
  cardSeconds: number;
  missedSeconds: number;
  phantomSeconds: number;
  passes: number;
  passesWithCard: number;
  cards: number;
  cardsWithNothingToNotice: number;
  startDelaysSeconds: number[];
  missedNeverListed: number;
  missedListedNoCard: number;
}

const NM_PER_KM = 1 / 1.852;
const EARTH_RADIUS_KM = 6371;

export async function replay(
  snapshots: Snapshot[],
  observers: Observer[],
  stageOf: (aircraft: Aircraft) => PassStage | null = passStage,
): Promise<Map<string, Moment[]>> {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  let current: Snapshot = snapshots[0] ?? { at: 0, planes: [] };
  const positions = {
    aircraftNear: async (point: GeoPoint, radiusNm: number) => relativeTo(point, current.planes, radiusNm),
  };
  const routes = { routeFor: async () => null };
  const users = createUserStore(observers.length);
  const push = new FakePush();
  const listed = new Map<string, string[]>();
  const sky = createSky(positions, routes, stageOf);
  const listingSky = {
    planesAbove: async (point: GeoPoint) => {
      const planes = await sky.planesAbove(point);
      listed.set(
        `${point.lat},${point.lon}`,
        planes.map(({ id }) => id),
      );
      return planes;
    },
  };
  const watcher = createWatcher({
    users,
    sky: listingSky,
    push,
    now: () => current.at,
  });

  const people = observers.map((observer) => {
    const user = users.upsert(
      registerRequest({
        deviceId: observer.name,
        lat: observer.at.lat,
        lon: observer.at.lon,
        startToken: observer.name,
      }),
    );
    return {
      observer,
      user,
      person: new Person(observer.at, observer.rooftopDeg),
      card: false,
      stage: undefined as string | undefined,
      moments: [] as Moment[],
    };
  });

  let previousAt = current.at;
  for (const snapshot of snapshots) {
    current = snapshot;
    const sentBefore = push.sent.length;
    await watcher.tick();
    for (const { event, token, props } of push.sent.slice(sentBefore)) {
      const entry = people.find(({ user }) => user.startToken === token || user.activityTokens.has(token));
      if (!entry) continue;
      entry.stage = props.stage;
      if (event === 'start') {
        entry.card = true;
        await watcher.reportActivityTokens(entry.user, [`card-${entry.observer.name}-${snapshot.at}`]);
      }
      if (event === 'end') entry.card = false;
    }

    const dtSeconds = Math.max(0, (snapshot.at - previousAt) / 1000);
    for (const entry of people) {
      const aware = entry.person.look(inSky(snapshot.planes), dtSeconds);
      entry.moments.push({
        at: snapshot.at,
        card: entry.card && isShowing(entry.user),
        stage: entry.stage,
        listed: listed.get(`${entry.observer.at.lat},${entry.observer.at.lon}`) ?? [],
        aware: [...aware.keys()],
      });
    }
    previousAt = snapshot.at;
  }

  vi.restoreAllMocks();
  return new Map(people.map(({ observer, moments }) => [observer.name, moments]));
}

const isShowing = (user: User) => user.activity.showing !== undefined;

const PASS_GAP_SECONDS = 15;

export function score(moments: Moment[]): Scorecard {
  const card: Scorecard = {
    awareSeconds: 0,
    cardSeconds: 0,
    missedSeconds: 0,
    phantomSeconds: 0,
    passes: 0,
    passesWithCard: 0,
    cards: 0,
    cardsWithNothingToNotice: 0,
    startDelaysSeconds: [],
    missedNeverListed: 0,
    missedListedNoCard: 0,
  };

  type Pass = { start: number; last: number; carded: boolean; listed: boolean; firstCard?: number };
  const passes = new Map<string, Pass>();
  const closed: Pass[] = [];
  let cardSession: { awareAtAll: boolean } | undefined;

  moments.forEach((moment, index) => {
    const dt = index === 0 ? 0 : (moment.at - (moments[index - 1]?.at ?? moment.at)) / 1000;
    const aware = moment.aware.length > 0;
    if (aware) card.awareSeconds += dt;
    if (moment.card) card.cardSeconds += dt;
    if (aware && !moment.card) card.missedSeconds += dt;
    if (!aware && moment.card) card.phantomSeconds += dt;

    if (moment.card && !cardSession) {
      card.cards += 1;
      cardSession = { awareAtAll: false };
    }
    if (cardSession && aware) cardSession.awareAtAll = true;
    if (!moment.card && cardSession) {
      if (!cardSession.awareAtAll) card.cardsWithNothingToNotice += 1;
      cardSession = undefined;
    }

    for (const id of moment.aware) {
      const open = passes.get(id);
      if (open && (moment.at - open.last) / 1000 <= PASS_GAP_SECONDS) {
        open.last = moment.at;
      } else {
        if (open) closed.push(open);
        passes.set(id, { start: moment.at, last: moment.at, carded: false, listed: false });
      }
      const pass = passes.get(id);
      if (pass && moment.listed.includes(id)) pass.listed = true;
      if (pass && moment.card) {
        pass.carded = true;
        pass.firstCard ??= moment.at;
      }
    }
  });
  if (cardSession && !cardSession.awareAtAll) card.cardsWithNothingToNotice += 1;

  for (const pass of [...closed, ...passes.values()]) {
    card.passes += 1;
    if (!pass.carded) {
      if (pass.listed) card.missedListedNoCard += 1;
      else card.missedNeverListed += 1;
      continue;
    }
    card.passesWithCard += 1;
    card.startDelaysSeconds.push(((pass.firstCard ?? pass.start) - pass.start) / 1000);
  }
  return card;
}

function inSky(planes: RecordedPlane[]): PlaneInSky[] {
  return planes.flatMap((plane) =>
    typeof plane.alt === 'number'
      ? [
          {
            id: plane.hex,
            typeCode: plane.type,
            category: plane.cat,
            lat: plane.lat,
            lon: plane.lon,
            altitudeFt: plane.geom ?? plane.alt,
            trackDeg: plane.track ?? 0,
          },
        ]
      : [],
  );
}

function relativeTo(point: GeoPoint, planes: RecordedPlane[], radiusNm: number): Aircraft[] {
  return planes.flatMap((plane) => {
    if (typeof plane.alt !== 'number' || !plane.flight) return [];
    const northKm = toRadians(plane.lat - point.lat) * EARTH_RADIUS_KM;
    const eastKm = toRadians(plane.lon - point.lon) * EARTH_RADIUS_KM * Math.cos(toRadians(point.lat));
    const distanceKm = Math.hypot(northKm, eastKm);
    if (distanceKm * NM_PER_KM > radiusNm) return [];
    return [
      {
        id: plane.hex,
        flight: plane.flight,
        typeCode: plane.type,
        category: plane.cat,
        altitudeFt: plane.geom ?? plane.alt,
        verticalRateFpm: plane.rate,
        groundSpeedKt: plane.gs ?? 0,
        trackDeg: plane.track ?? 0,
        distanceNm: distanceKm * NM_PER_KM,
        bearingDeg: (toDegrees(Math.atan2(eastKm, northKm)) + 360) % 360,
      },
    ];
  });
}

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const toDegrees = (rad: number) => (rad * 180) / Math.PI;
