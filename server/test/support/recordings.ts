import { readFileSync } from 'node:fs';
import { cityStreet } from './person.js';
import type { Observer, RecordedPlane, Snapshot } from './replay.js';

export function loadRecording(path: string): Snapshot[] {
  const byTime = new Map<number, RecordedPlane[]>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue;
    const { t, ...plane } = JSON.parse(line) as RecordedPlane & { t: number };
    byTime.set(t, [...(byTime.get(t) ?? []), plane]);
  }
  return [...byTime].sort(([a], [b]) => a - b).map(([at, planes]) => ({ at, planes }));
}

export function streetsAround(lat: number, lon: number, size = 6, stepDeg = 0.02): Observer[] {
  return Array.from({ length: size * size }, (_, index) => ({
    name: `street-${index}`,
    at: {
      lat: lat + (Math.floor(index / size) - size / 2) * stepDeg,
      lon: lon + ((index % size) - size / 2) * stepDeg,
    },
    rooftopDeg: cityStreet(index + 1),
  }));
}
