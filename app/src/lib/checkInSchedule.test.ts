import { describe, expect, it } from 'vitest';
import { cardsTooOld, isCheckInDue, MAX_SILENCE_MS } from './checkInSchedule';

const MINUTE = 60_000;

describe('when the phone checks in', () => {
  const last = { cardTokens: 'card-1', at: 0 };

  it('checks in when a new card token appears', () => {
    expect(isCheckInDue(last, ['card-1', 'card-2'], 1000)).toBe(true);
  });

  it('stays quiet while nothing changed', () => {
    expect(isCheckInDue(last, ['card-1'], 1000)).toBe(false);
    expect(isCheckInDue(last, [], 1000)).toBe(false);
  });

  it('checks in at least once a minute anyway', () => {
    expect(isCheckInDue(last, ['card-1'], MAX_SILENCE_MS + 1)).toBe(true);
  });
});

describe('closing old cards', () => {
  it('closes a card that has been open longer than the limit', () => {
    const firstSeen = new Map([['old', 0]]);
    expect(cardsTooOld(firstSeen, ['old', 'new'], 31 * MINUTE).tooOld).toEqual(['old']);
  });

  it('starts timing a card the first time it is seen', () => {
    const { firstSeen } = cardsTooOld(new Map(), ['new'], 5 * MINUTE);
    expect(firstSeen.get('new')).toBe(5 * MINUTE);
  });

  it('forgets cards that are no longer open', () => {
    const { firstSeen } = cardsTooOld(new Map([['gone', 0]]), [], MINUTE);
    expect([...firstSeen.keys()]).toEqual([]);
  });
});
