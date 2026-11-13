import { describe, expect, it } from 'vitest';
import { aircraftName } from '../src/flights/aircraft.js';
import { airlineName } from '../src/flights/airlines.js';

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

describe('airlineName', () => {
  it('names the airline from the callsign prefix', () => {
    expect(airlineName('ISR053')).toBe('Israir');
    expect(airlineName('ETD9702')).toBe('Etihad Airways');
    expect(airlineName('ELY386')).toBe('El Al Israel Airlines');
  });

  it('names newer airlines and airline subsidiaries', () => {
    expect(airlineName('WMT5012')).toBe('Wizz Air Malta');
    expect(airlineName('WUK4320')).toBe('Wizz Air UK');
    expect(airlineName('HFA405')).toBe('airHaifa');
    expect(airlineName('CHZ674')).toBe('Challenge Air Cargo');
  });

  it('gives no airline for private aircraft that fly under their registration', () => {
    expect(airlineName('4XHSC')).toBeUndefined();
    expect(airlineName('N')).toBeUndefined();
  });

  it('gives no airline for an unknown prefix', () => {
    expect(airlineName('QZQ123')).toBeUndefined();
  });
});
