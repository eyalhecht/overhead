import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { passStage as currentRule } from './support/currentRule.js';
import { replay, score, type Observer, type Scorecard, type Snapshot } from './support/replay.js';
import { loadRecording, streetsAround } from './support/recordings.js';
import { ACTIVITY_RULES } from '../src/activity/policy.js';
import { PASS_RULES, passStage, type PassRules } from '../src/flights/geometry.js';
import type { Aircraft } from '../src/flights/geometry.js';

// Tries rule settings on every recording in a folder: RECORDINGS=path/to/folder npx vitest run sweep
const folder = process.env.RECORDINGS;

const CENTERS: Record<string, [number, number]> = {
  '2026-11-03': [32.07, 34.8],
  london: [51.486, -0.2],
  newyork: [40.73, -73.85],
  frankfurt: [50.06, 8.62],
  amsterdam: [52.33, 4.72],
  atlanta: [33.66, -84.36],
};

const candidates = (): [string, (aircraft: Aircraft) => ReturnType<typeof passStage>][] => {
  const list: [string, (aircraft: Aircraft) => ReturnType<typeof passStage>][] = [['current', currentRule]];
  for (const inboundLeadSeconds of (process.env.INBOUNDS ?? '120').split(',').map(Number))
    for (const approachLeadSeconds of [10, 20, 30, 45]) {
      for (const minVisualAngleDeg of [0.4, 0.5, 0.7]) {
        for (const minElevationDeg of [15, 25]) {
          for (const streetNoiseDb of [55, 62]) {
            const rules: PassRules = {
              ...PASS_RULES,
              approachLeadSeconds,
              inboundLeadSeconds,
              notice: { minVisualAngleDeg, minElevationDeg, streetNoiseDb },
            };
            list.push([
              `inbound ${inboundLeadSeconds} lead ${approachLeadSeconds} angle ${minVisualAngleDeg} elev ${minElevationDeg} noise ${streetNoiseDb}`,
              (aircraft) => passStage(aircraft, rules),
            ]);
          }
        }
      }
    }
  const only = process.env.ONLY;
  return only ? list.filter(([name]) => only.split(';').includes(name)) : list;
};

describe.skipIf(!folder || !existsSync(folder))('sweep', () => {
  it('scores every candidate on every recording', { timeout: 3_600_000 }, async () => {
    const datasets: [Snapshot[], Observer[]][] = readdirSync(folder ?? '')
      .filter((file) => file.startsWith('tracks-') && file.endsWith('.jsonl'))
      .flatMap((file) => {
        const center = CENTERS[file.slice('tracks-'.length, -'.jsonl'.length)];
        return center
          ? [[loadRecording(join(folder ?? '', file)), streetsAround(...center)] as [Snapshot[], Observer[]]]
          : [];
      });

    const rows: string[] = [];
    const lingers = (process.env.LINGERS ?? String(ACTIVITY_RULES.passedLingerMs)).split(',').map(Number);
    const rules = ACTIVITY_RULES as { passedLingerMs: number };
    const defaultLinger = rules.passedLingerMs;
    for (const [baseName, rule] of candidates())
      for (const linger of lingers) {
        rules.passedLingerMs = linger;
        const name = `${baseName} linger ${linger / 1000}`;
        const cards: Scorecard[] = [];
        const byStage: Record<string, number> = {};
        for (const [snapshots, observers] of datasets) {
          const results = await replay(snapshots, observers, rule);
          cards.push(...[...results.values()].map(score));
          for (const moments of results.values()) {
            for (const moment of moments) {
              if (moment.card && moment.aware.length === 0)
                byStage[moment.stage ?? '?'] = (byStage[moment.stage ?? '?'] ?? 0) + 5;
            }
          }
        }
        const sum = (key: keyof Omit<Scorecard, 'startDelaysSeconds'>) =>
          cards.reduce((total, card) => total + card[key], 0);
        rows.push(
          [
            name.padEnd(50),
            `passes ${sum('passesWithCard')}/${sum('passes')}`,
            `missed: not flagged ${sum('missedNeverListed')}, flagged ${sum('missedListedNoCard')}`,
            `missed ${Math.round(sum('missedSeconds'))}s`,
            `nothing-to-notice ${Math.round(sum('phantomSeconds'))}s`,
            `empty cards ${sum('cardsWithNothingToNotice')}/${sum('cards')}`,
            JSON.stringify(byStage),
          ].join(' | '),
        );
      }
    rules.passedLingerMs = defaultLinger;
    process.stdout.write(`${rows.join('\n')}\n`);
  });
});
