import type { NearbyPlane } from '@overhead/shared';
import { useEffect, useState } from 'react';
import { fetchPlanesAbove, type Coordinates } from '@/services/api';

const REFRESH_INTERVAL_MS = 5000;

export function useNearbyPlanes(location: Coordinates | undefined): NearbyPlane[] {
  const [planes, setPlanes] = useState<NearbyPlane[]>([]);

  useEffect(() => {
    if (!location) return;
    let active = true;

    const refresh = () =>
      fetchPlanesAbove(location)
        .then((latest) => active && setPlanes(latest))
        .catch(() => undefined);

    void refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [location]);

  return planes;
}
