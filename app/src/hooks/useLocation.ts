import type { GeoPoint } from '@overhead/shared';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { checkIn } from '@/services/checkIn';
import { requestLocationAccess, toCoordinates } from '@/services/location';
import { useSubscription } from './useSubscription';

export type LocationPermission = 'unknown' | 'granted' | 'denied';

const FOREGROUND_DISTANCE_M = 50;

export function useLocation() {
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  const [location, setLocation] = useState<GeoPoint>();

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then(({ granted, canAskAgain }) =>
      setPermission(granted ? 'granted' : canAskAgain ? 'unknown' : 'denied'),
    );
  }, []);

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
    setPermission(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  return { location, permission, requestAccess };
}
