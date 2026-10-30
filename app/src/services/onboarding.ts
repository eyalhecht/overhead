import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'onboarded';

export async function isOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, 'true');
}
