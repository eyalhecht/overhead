import type { GeoPoint } from '@overhead/shared';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { checkIn } from '@/services/checkIn';
import { requestLocationAccess, toCoordinates } from '@/services/location';
import { useSubscription } from './useSubscription';

export type LocationPermission = 'unknown' | 'granted' | 'denied';

const FOREGROUND_DISTANCE_M = 50;

export function useLocation() {
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  const [location, setLocation] = useState<GeoPoint>();
  const [alwaysAllowed, setAlwaysAllowed] = useState<boolean>();

  // Checked again whenever the app comes back, since the user may have changed it in iOS Settings.
  const refreshPermissions = useCallback(
    () =>
      readPermissions().then((current) => {
        setPermission(current.permission);
        setAlwaysAllowed(current.alwaysAllowed);
      }),
    [],
  );

  useEffect(() => {
    void refreshPermissions();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermissions();
    });
    return () => subscription.remove();
  }, [refreshPermissions]);

  const watchPosition = useCallback(
    () =>
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: FOREGROUND_DISTANCE_M },
        (update) => {
          const coordinates = toCoordinates(update);
          setLocation(coordinates);
          void checkIn(coordinates);
        },
      ),
    [],
  );
  useSubscription(permission === 'granted' ? watchPosition : undefined);

  const requestAccess = useCallback(async () => {
    const granted = await requestLocationAccess();
    await refreshPermissions();
    return granted;
  }, [refreshPermissions]);

  return { location, permission, alwaysAllowed, requestAccess };
}

async function readPermissions(): Promise<{ permission: LocationPermission; alwaysAllowed: boolean }> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  const permission = foreground.granted ? 'granted' : foreground.canAskAgain ? 'unknown' : 'denied';
  return { permission, alwaysAllowed: background.granted };
}
