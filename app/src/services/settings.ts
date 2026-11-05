import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  liveActivities: boolean;
  quietHours: boolean;
}

const STORAGE_KEY = 'settings';
const DEFAULT_SETTINGS: Settings = { liveActivities: true, quietHours: true };

type Listener = (settings: Settings) => void;
const listeners = new Set<Listener>();
let current: Promise<Settings> | undefined;

export function loadSettings(): Promise<Settings> {
  current ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => ({ ...DEFAULT_SETTINGS, ...(stored ? JSON.parse(stored) : {}) }))
    .catch(() => DEFAULT_SETTINGS);
  return current;
}

export async function saveSettings(settings: Settings): Promise<void> {
  current = Promise.resolve(settings);
  listeners.forEach((listener) => listener(settings));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function onSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
