import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export function useHeading(enabled: boolean): number {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    void Location.watchHeadingAsync(({ trueHeading, magHeading }) =>
      setHeading(trueHeading >= 0 ? trueHeading : magHeading),
    ).then((created) => {
      if (cancelled) created.remove();
      else subscription = created;
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return heading;
}
