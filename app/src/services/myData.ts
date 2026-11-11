import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIosIdForVendorAsync } from 'expo-application';
import OverheadActivity from '@/live-activity/OverheadActivity';
import { forgetPhone } from './api';
import { stopBackgroundLocation } from './location';

// The server forgets the phone first; only then does the phone clear its own copy,
// so a failed request leaves everything as it was and the user can try again.
export async function deleteMyData(): Promise<void> {
  const deviceId = await getIosIdForVendorAsync();
  if (deviceId) await forgetPhone(deviceId);
  await stopBackgroundLocation();
  await Promise.all(
    OverheadActivity.getInstances().map((card) => card.end('immediate').catch(() => undefined)),
  );
  await AsyncStorage.clear();
}
