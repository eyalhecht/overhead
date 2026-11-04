import { describe, expect, it } from 'vitest';
import { cityStreet, openPark, Person, type PlaneInSky } from './support/person.js';

const HERE = { lat: 32.0637, lon: 34.7737 };
const KM_PER_DEG_LAT = 111.2;

const plane = (northKm: number, altitudeFt: number, typeCode = 'B738'): PlaneInSky => ({
  id: typeCode,
  typeCode,
  lat: HERE.lat + northKm / KM_PER_DEG_LAT,
  lon: HERE.lon,
  altitudeFt,
  trackDeg: 0,
});

const secondsToNotice = (person: Person, sky: PlaneInSky, limit = 120) => {
  for (let second = 0; second <= limit; second += 5) {
    if (person.look([sky], 5).get(sky.id)?.seen) return second;
  }
  return undefined;
};

describe('the simulated person', () => {
  it('notices an airliner at 3,000 ft right above them within seconds', () => {
    expect(secondsToNotice(new Person(HERE, openPark), plane(0, 3000))).toBeLessThanOrEqual(5);
  });

  it('never notices an airliner cruising at 36,000 ft', () => {
    expect(secondsToNotice(new Person(HERE, openPark), plane(0, 36_000))).toBeUndefined();
  });

  it('cannot see a plane behind the rooftops, even a big one', () => {
    const behindRooftops = plane(9, 4000, 'B77W');
    expect(secondsToNotice(new Person(HERE, () => 30), behindRooftops)).toBeUndefined();
  });

  it('hears a low airliner overhead, but not one 6 km away', () => {
    const person = new Person(HERE, () => 90);
    expect(person.look([plane(0, 1500)], 5).get('B738')?.heard).toBe(true);
    expect(person.look([plane(6, 1500)], 5).get('B738')).toBeUndefined();
  });

  it('loses sight of a plane once it shrinks to a dot', () => {
    const person = new Person(HERE, openPark);
    person.look([plane(0, 3000)], 5);
    expect(person.look([plane(25, 30_000)], 5).get('B738')).toBeUndefined();
  });

  it('notices a 777 farther away than a Cessna', () => {
    const far = (type: string) => secondsToNotice(new Person(HERE, openPark), plane(3, 4000, type), 60);
    expect(far('B77W')).toBeDefined();
    expect(far('C172')).toBeUndefined();
  });

  it('sees different rooftops on different streets', () => {
    expect(cityStreet(1)(10)).not.toBe(cityStreet(2)(10));
  });
});
