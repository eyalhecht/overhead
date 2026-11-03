import type { ActivityProps, GeoPoint, NearbyPlane } from '@overhead/shared';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useCard } from './useCard';
import { useHeading } from './useHeading';
import { useLocation, type LocationPermission } from './useLocation';
import { useNearbyPlanes } from './useNearbyPlanes';

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

export function SkyProvider({ children }: PropsWithChildren) {
  const { location, permission, requestAccess } = useLocation();
  const heading = useHeading(permission === 'granted');
  const planes = useNearbyPlanes(location);
  const card = useCard();

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
