import { existsSync } from 'node:fs';
import { describe, it } from 'vitest';
import { passStage as currentRule } from './support/currentRule.js';
import { loadRecording, streetsAround } from './support/recordings.js';
import { replay, score } from './support/replay.js';
import { passStage as newRule } from '../src/flights/geometry.js';

// Scores rules against a long local recording: RECORDING=path/to/tracks.jsonl npx vitest run scorecard
const recording = process.env.RECORDING;

describe.skipIf(!recording || !existsSync(recording))('scorecard on a recording', () => {
  it('compares the current rule with the new one', { timeout: 600_000 }, async () => {
    const snapshots = loadRecording(recording ?? '');
    const observers = streetsAround(32.07, 34.8);
    for (const [name, rule] of [
      ['current', currentRule],
      ['new', newRule],
    ] as const) {
      const results = await replay(snapshots, observers, rule);
      const phantomByStage: Record<string, number> = {};
      for (const moments of results.values()) {
        for (const moment of moments) {
          if (moment.card && moment.aware.length === 0) {
            phantomByStage[moment.stage ?? '?'] = (phantomByStage[moment.stage ?? '?'] ?? 0) + 5;
          }
        }
      }
      process.stdout.write(`${name} nothing-to-notice seconds by stage: ${JSON.stringify(phantomByStage)}
`);
      const total = [...results.values()].map(score).reduce((sum, card) => ({
        ...sum,
        awareSeconds: sum.awareSeconds + card.awareSeconds,
        cardSeconds: sum.cardSeconds + card.cardSeconds,
        missedSeconds: sum.missedSeconds + card.missedSeconds,
        phantomSeconds: sum.phantomSeconds + card.phantomSeconds,
        passes: sum.passes + card.passes,
        passesWithCard: sum.passesWithCard + card.passesWithCard,
        cards: sum.cards + card.cards,
        cardsWithNothingToNotice: sum.cardsWithNothingToNotice + card.cardsWithNothingToNotice,
        startDelaysSeconds: [...sum.startDelaysSeconds, ...card.startDelaysSeconds],
      }));
      const delays = total.startDelaysSeconds.sort((a, b) => a - b);
      process.stdout.write(
        `${name}: passes ${total.passes}, with card ${total.passesWithCard} (${pct(total.passesWithCard, total.passes)}), ` +
          `cards ${total.cards}, cards with nothing to notice ${total.cardsWithNothingToNotice}, ` +
          `card time while aware ${pct(total.awareSeconds - total.missedSeconds, total.awareSeconds)}, ` +
          `card time with nothing to notice ${pct(total.phantomSeconds, total.cardSeconds)}, ` +
          `median card delay ${delays[Math.floor(delays.length / 2)] ?? '-'} s\n`,
      );
    }
  });
});

const pct = (part: number, whole: number) => `${whole ? Math.round((100 * part) / whole) : 0}%`;
