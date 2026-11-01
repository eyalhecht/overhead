import { useEffect } from 'react';

interface Subscription {
  remove(): void;
}

export function useSubscription(subscribe: (() => Promise<Subscription>) | undefined): void {
  useEffect(() => {
    if (!subscribe) return;
    let subscription: Subscription | undefined;
    let cancelled = false;

    void subscribe().then((created) => {
      if (cancelled) created.remove();
      else subscription = created;
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [subscribe]);
}
