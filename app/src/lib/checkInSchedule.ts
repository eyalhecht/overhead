import { CARD_MAX_AGE_MS } from '@overhead/shared/rules';

export const MAX_SILENCE_MS = 60_000;

export interface LastReport {
  activityTokens: string;
  at: number;
}

export function isCheckInDue(last: LastReport, openCardTokens: string[], now: number): boolean {
  const tokens = openCardTokens.join();
  const tokensChanged = tokens !== '' && tokens !== last.activityTokens;
  return tokensChanged || now - last.at > MAX_SILENCE_MS;
}

export function cardsTooOld(
  previous: Map<string, number>,
  openCardIds: string[],
  now: number,
): { firstSeen: Map<string, number>; tooOld: string[] } {
  const firstSeen = new Map(openCardIds.map((id) => [id, previous.get(id) ?? now]));
  const tooOld = openCardIds.filter((id) => now - (firstSeen.get(id) ?? now) > CARD_MAX_AGE_MS);
  return { firstSeen, tooOld };
}
