import type { ActivityProps, GeoPoint, NearbyPlane, SkySnapshot } from '@overhead/shared';
import { getIosIdForVendorAsync } from 'expo-application';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { fetchSky } from '@/services/api';
import { useLocation, type LocationPermission } from './useLocation';
import { usePolling } from './usePolling';
import { useSubscription } from './useSubscription';

interface Sky {
  location?: GeoPoint;
  permission: LocationPermission;
  requestAccess: () => Promise<boolean>;
  heading: number;
  planes: NearbyPlane[];
  card: ActivityProps | null;
  cardPlane?: NearbyPlane;
}

const SkyContext = createContext<Sky | null>(null);
const EMPTY_SKY: SkySnapshot = { planes: [], card: null };

export function SkyProvider({ children }: PropsWithChildren) {
  const { location, permission, requestAccess } = useLocation();
  const [heading, setHeading] = useState(0);

  const watchHeading = useCallback(
    () =>
      Location.watchHeadingAsync(({ trueHeading, magHeading }) =>
        setHeading(trueHeading >= 0 ? trueHeading : magHeading),
      ),
    [],
  );
  useSubscription(permission === 'granted' ? watchHeading : undefined);

  const loadSky = useCallback(async () => {
    const deviceId = await getIosIdForVendorAsync();
    return deviceId ? fetchSky(deviceId) : EMPTY_SKY;
  }, []);
  const { planes, card } = usePolling(loadSky, EMPTY_SKY);

  const sky = useMemo<Sky>(
    () => ({
      location,
      permission,
      requestAccess,
      heading,
      planes,
      card,
      cardPlane: planes.find((plane) => plane.flight === card?.flight),
    }),
    [location, permission, requestAccess, heading, planes, card],
  );

  return <SkyContext.Provider value={sky}>{children}</SkyContext.Provider>;
}

export function useSky(): Sky {
  const sky = useContext(SkyContext);
  if (!sky) throw new Error('useSky must be used inside SkyProvider');
  return sky;
}
