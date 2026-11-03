import { useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 5000;

export function usePolling<T>(load: (() => Promise<T>) | undefined, initial: T): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (!load) return;
    let active = true;

    const refresh = () =>
      load()
        .then((latest) => active && setValue(latest))
        .catch(() => undefined);

    void refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [load]);

  return value;
}
