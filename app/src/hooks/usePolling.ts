import { useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 5000;

export function usePolling<T>(load: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () =>
      load()
        .then((latest) => active && setValue(latest))
        .catch(() => undefined)
        .finally(() => {
          if (active) timer = setTimeout(refresh, REFRESH_INTERVAL_MS);
        });

    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);

  return value;
}
