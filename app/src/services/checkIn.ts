import type { GeoPoint } from '@overhead/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIosIdForVendorAsync } from 'expo-application';
import { addPushToStartTokenListener } from 'expo-widgets';
import OverheadActivity from '@/live-activity/OverheadActivity';
import { register } from './api';
import { QUIET_HOURS, roughLocation } from '@overhead/shared/rules';
import { cardsTooOld, isCheckInDue, type LastReport } from '@/lib/checkInSchedule';
import { loadSettings, onSettingsChange } from './settings';

const LOCATION_STORAGE_KEY = 'lastLocation';
const MAINTENANCE_INTERVAL_MS = 5000;

let startToken: string | undefined;
let lastLocation: GeoPoint | undefined;
let lastReport: LastReport = { activityTokens: '', at: 0 };
let cardFirstSeen = new Map<string, number>();

export async function checkIn(location?: GeoPoint): Promise<void> {
  if (location) await rememberLocation(location);
  const target = lastLocation ?? (await storedLocation());
  if (!target) return;

  const [deviceId, settings, activityTokens] = await Promise.all([
    getIosIdForVendorAsync(),
    loadSettings(),
    openCardTokens(),
  ]);
  if (!deviceId) return;

  await register({
    deviceId,
    ...target,
    startToken: settings.liveActivities ? startToken : undefined,
    activityTokens,
    quietHours: settings.quietHours ? QUIET_HOURS : null,
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  });
  lastReport = { activityTokens: activityTokens.join(), at: Date.now() };
}

export function startCheckInService(): void {
  addPushToStartTokenListener(({ activityPushToStartToken }) => {
    startToken = activityPushToStartToken;
    void safeCheckIn();
  });
  onSettingsChange(() => void safeCheckIn());
  setInterval(() => void maintain(), MAINTENANCE_INTERVAL_MS);
}

async function maintain(): Promise<void> {
  closeOldCards();
  if (isCheckInDue(lastReport, await openCardTokens(), Date.now())) await safeCheckIn();
}

async function safeCheckIn(): Promise<void> {
  try {
    await checkIn();
  } catch (error) {
    console.warn(`Check-in failed: ${(error as Error).message}`);
  }
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

async function rememberLocation(location: GeoPoint): Promise<void> {
  lastLocation = roughLocation(location);
  await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(lastLocation));
}

async function storedLocation(): Promise<GeoPoint | undefined> {
  const stored = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
  lastLocation = stored ? (JSON.parse(stored) as GeoPoint) : undefined;
  return lastLocation;
}
