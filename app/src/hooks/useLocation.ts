import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import type { Coordinates } from '@/services/api';
import { checkIn } from '@/services/checkIn';
import { requestLocationAccess, toCoordinates } from '@/services/location';

export type LocationPermission = 'unknown' | 'granted' | 'denied';

const FOREGROUND_DISTANCE_M = 50;

export function useLocation() {
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  const [location, setLocation] = useState<Coordinates>();

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then(({ granted, canAskAgain }) =>
      setPermission(granted ? 'granted' : canAskAgain ? 'unknown' : 'denied'),
    );
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: FOREGROUND_DISTANCE_M },
      (update) => {
        const coordinates = toCoordinates(update);
        setLocation(coordinates);
        void checkIn(coordinates).catch(() => undefined);
      },
    ).then((created) => {
      if (cancelled) created.remove();
      else subscription = created;
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [permission]);

  const requestAccess = useCallback(async () => {
    const granted = await requestLocationAccess();
    setPermission(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  return { location, permission, requestAccess };
}
