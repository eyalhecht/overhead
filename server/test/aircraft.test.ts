import { describe, expect, it } from 'vitest';
import { aircraftName, rareAircraftName } from '../src/flights/aircraft.js';

describe('aircraftName', () => {
  it('turns ICAO type codes into the names people know', () => {
    expect(aircraftName('A21N')).toBe('A321neo');
    expect(aircraftName('B77W')).toBe('777-300ER');
  });

  it('keeps unknown codes and handles a missing type', () => {
    expect(aircraftName('ZZZZ')).toBe('ZZZZ');
    expect(aircraftName(undefined)).toBeUndefined();
  });
});

describe('rareAircraftName', () => {
  it('names rare aircraft only', () => {
    expect(rareAircraftName('B748')).toBe('747-8');
    expect(rareAircraftName('A388')).toBe('A380');
    expect(rareAircraftName('A20N')).toBeUndefined();
  });
});
