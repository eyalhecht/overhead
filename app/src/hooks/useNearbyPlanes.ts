import type { GeoPoint, NearbyPlane } from '@overhead/shared';
import { useMemo } from 'react';
import { fetchPlanesAbove } from '@/services/api';
import { usePolling } from './usePolling';

export function useNearbyPlanes(location: GeoPoint | undefined): NearbyPlane[] {
  const load = useMemo(() => (location ? () => fetchPlanesAbove(location) : undefined), [location]);
  return usePolling(load, []);
}
