import type { GeoPoint } from '@overhead/shared';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { checkIn } from './checkIn';

const BACKGROUND_TASK = 'overhead-background-location';
const BACKGROUND_DISTANCE_M = 500;

interface BackgroundLocationData {
  locations: Location.LocationObject[];
}

TaskManager.defineTask<BackgroundLocationData>(BACKGROUND_TASK, async ({ data, error }) => {
  const latest = data?.locations.at(-1);
  if (error || !latest) return;
  await checkIn(toCoordinates(latest));
});

export function toCoordinates(location: Location.LocationObject): GeoPoint {
  return { lat: location.coords.latitude, lon: location.coords.longitude };
}

export async function requestLocationAccess(): Promise<boolean> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (granted) await startBackgroundLocation();
  return granted;
}

async function startBackgroundLocation(): Promise<void> {
  const { granted } = await Location.requestBackgroundPermissionsAsync();
  if (!granted || (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK))) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
    accuracy: Location.Accuracy.Low,
    distanceInterval: BACKGROUND_DISTANCE_M,
    deferredUpdatesDistance: BACKGROUND_DISTANCE_M,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
  });
}
