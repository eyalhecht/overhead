import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { useSubscription } from './useSubscription';

export function useHeading(enabled: boolean): number {
  const [heading, setHeading] = useState(0);

  const watchHeading = useCallback(
    () =>
      Location.watchHeadingAsync(({ trueHeading, magHeading }) =>
        setHeading(trueHeading >= 0 ? trueHeading : magHeading),
      ),
    [],
  );
  useSubscription(enabled ? watchHeading : undefined);

  return heading;
}
