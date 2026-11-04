import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadRecording } from './support/recordings.js';
import { passStage as currentRule } from './support/currentRule.js';
import { simulate, type Flight } from './support/flights.js';
import { cityStreet, openPark } from './support/person.js';
import { replay, score, type Scorecard } from './support/replay.js';
import { passStage as newRule } from '../src/flights/geometry.js';

// The 10 s heads-up plus the 20 s Passed linger: card time the product accepts with nothing in sight.
const HEADS_UP_AND_PASSED_SECONDS = 30;
const ROTHSCHILD = { lat: 32.0637, lon: 34.7737 };

interface Scenario {
  name: string;
  flights: Flight[];
  park?: boolean;
  noticeable: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'airliner 3,000 ft straight overhead',
    flights: [{ flight: 'ELY1', typeCode: 'B738', altitudeFt: 3000 }],
    noticeable: true,
  },
  {
    name: 'landing A320 at 1,700 ft, 200 m to the side',
    flights: [
      {
        flight: 'LOT2YE',
        typeCode: 'A320',
        altitudeFt: 1700,
        verticalRateFpm: -800,
        speedKt: 150,
        sideKm: 0.2,
      },
    ],
    noticeable: true,
  },
  {
    name: 'departure climbing through 5,000 ft overhead',
    flights: [{ flight: 'ISR053', typeCode: 'B738', altitudeFt: 5000, verticalRateFpm: 2500, speedKt: 220 }],
    noticeable: true,
  },
  {
    name: 'widebody at 9,000 ft, 4 km to the side, seen from a park',
    flights: [{ flight: 'ELY1', typeCode: 'B789', altitudeFt: 9000, speedKt: 250, sideKm: 4 }],
    park: true,
    noticeable: true,
  },
  {
    name: 'Cessna 1,500 ft overhead',
    flights: [{ flight: '4XCAB', typeCode: 'C172', altitudeFt: 1500, speedKt: 100 }],
    noticeable: true,
  },
  {
    name: 'airliner cruising at 36,000 ft',
    flights: [{ flight: 'THY1', typeCode: 'A21N', altitudeFt: 36000, speedKt: 450 }],
    noticeable: false,
  },
  {
    name: 'Cessna 2,000 ft, 2.5 km to the side',
    flights: [{ flight: '4XCAC', typeCode: 'C172', altitudeFt: 2000, speedKt: 100, sideKm: 2.5 }],
    noticeable: false,
  },
  {
    name: 'airliner 1,000 ft low on the horizon, 8 km away',
    flights: [{ flight: 'ELY2', typeCode: 'A320', altitudeFt: 1000, speedKt: 150, sideKm: 8 }],
    noticeable: false,
  },
  {
    name: 'airliner 3,000 ft, 3 km to the side behind rooftops',
    flights: [{ flight: 'ELY3', typeCode: 'A320', altitudeFt: 3000, speedKt: 180, sideKm: 3 }],
    noticeable: false,
  },
  {
    name: 'airliner overhead with a 20 s gap in coverage',
    flights: [{ flight: 'ELY4', typeCode: 'B738', altitudeFt: 3000, gapSeconds: [110, 130] }],
    noticeable: true,
  },
  {
    name: 'two airliners 90 s apart',
    flights: [
      { flight: 'ELY5', typeCode: 'B738', altitudeFt: 3000 },
      { flight: 'ELY6', typeCode: 'A320', altitudeFt: 2500, closestAtSeconds: 210 },
    ],
    noticeable: true,
  },
  {
    name: 'airliner that turns away 30 s before reaching you',
    flights: [{ flight: 'ELY7', typeCode: 'A320', altitudeFt: 4000, turnAwayAtSeconds: 90 }],
    noticeable: false,
  },
];

async function run(scenario: Scenario, rule: typeof newRule): Promise<Scorecard> {
  const observer = { name: 'me', at: ROTHSCHILD, rooftopDeg: scenario.park ? openPark : cityStreet(7) };
  const results = await replay(simulate(ROTHSCHILD, scenario.flights, 360), [observer], rule);
  return score(results.get('me') ?? []);
}

describe('a person on a Tel Aviv street', () => {
  it.each(SCENARIOS)(
    '$name: never worse than today, and a card for every plane they notice',
    async (scenario) => {
      const [today, tuned] = [await run(scenario, currentRule), await run(scenario, newRule)];

      expect(tuned.missedSeconds).toBeLessThanOrEqual(today.missedSeconds);
      expect(tuned.phantomSeconds).toBeLessThanOrEqual(
        Math.max(today.phantomSeconds, HEADS_UP_AND_PASSED_SECONDS),
      );
      if (scenario.noticeable) expect(tuned.passesWithCard).toBe(tuned.passes);
      else expect(tuned.cardSeconds).toBeLessThanOrEqual(HEADS_UP_AND_PASSED_SECONDS);
    },
  );
});

describe('a real pass: LOT2YE landing over Rothschild and Balfour on 3 Nov 2026', () => {
  it('shows a card while the person can see or hear it', async () => {
    const snapshots = loadRecording(
      fileURLToPath(new URL('./fixtures/lot2ye-over-rothschild.jsonl', import.meta.url)),
    );
    const observer = { name: 'me', at: ROTHSCHILD, rooftopDeg: cityStreet(7) };
    const card = score((await replay(snapshots, [observer], newRule)).get('me') ?? []);

    expect(card.passes).toBeGreaterThan(0);
    expect(card.passesWithCard).toBe(card.passes);
    expect(card.missedSeconds).toBeLessThanOrEqual(10);
  });
});
