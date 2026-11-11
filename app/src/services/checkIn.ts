import type { GeoPoint } from '@overhead/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIosIdForVendorAsync } from 'expo-application';
import { addPushToStartTokenListener } from 'expo-widgets';
import OverheadActivity from '@/live-activity/OverheadActivity';
import { register } from './api';
import { QUIET_HOURS } from '@overhead/shared/rules';
import { cardsTooOld, isCheckInDue, type LastReport } from '@/lib/checkInSchedule';
import { createLocationMemory } from './locationMemory';
import { isOnboarded } from './onboarding';
import { loadSettings, onSettingsChange } from './settings';

const MAINTENANCE_INTERVAL_MS = 5000;

let startToken: string | undefined;
const locationMemory = createLocationMemory(AsyncStorage);
let lastReport: LastReport = { cardTokens: '', at: 0 };
let cardFirstSeen = new Map<string, number>();

export async function checkIn(location?: GeoPoint): Promise<void> {
  try {
    await report(location);
  } catch (error) {
    console.warn(`Check-in failed: ${(error as Error).message}`);
  }
}

async function report(location?: GeoPoint): Promise<void> {
  if (location) await locationMemory.remember(location);
  const target = await locationMemory.recall();
  if (!target || !(await isOnboarded())) return;

  const [deviceId, settings, cardTokens] = await Promise.all([
    getIosIdForVendorAsync(),
    loadSettings(),
    openCardTokens(),
  ]);
  if (!deviceId) return;

  await register({
    deviceId,
    ...target,
    startToken: settings.liveActivities ? startToken : null,
    activityTokens: cardTokens,
    quietHours: settings.quietHours ? QUIET_HOURS : null,
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  });
  lastReport = { cardTokens: cardTokens.join(), at: Date.now() };
}

export function startCheckInService(): void {
  addPushToStartTokenListener(({ activityPushToStartToken }) => {
    startToken = activityPushToStartToken;
    void checkIn();
  });
  onSettingsChange(() => void checkIn());
  scheduleMaintenance();
}

function scheduleMaintenance(): void {
  setTimeout(async () => {
    await maintain();
    scheduleMaintenance();
  }, MAINTENANCE_INTERVAL_MS);
}

async function maintain(): Promise<void> {
  closeOldCards();
  if (isCheckInDue(lastReport, await openCardTokens(), Date.now())) await checkIn();
}

async function openCardTokens(): Promise<string[]> {
  const tokens = await Promise.all(
    OverheadActivity.getInstances().map((card) => card.getPushToken().catch(() => null)),
  );
  return tokens.filter((token): token is string => token !== null);
}

function closeOldCards(): void {
  const cards = OverheadActivity.getInstances();
  const { firstSeen, tooOld } = cardsTooOld(
    cardFirstSeen,
    cards.map((card) => card.getId()),
    Date.now(),
  );
  cardFirstSeen = firstSeen;
  for (const card of cards) {
    if (tooOld.includes(card.getId())) void card.end('immediate').catch(() => undefined);
  }
}
