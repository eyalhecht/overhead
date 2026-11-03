import type { ActivityProps } from '@overhead/shared';
import { getIosIdForVendorAsync } from 'expo-application';
import { useCallback } from 'react';
import { fetchCard } from '@/services/api';
import { usePolling } from './usePolling';

export function useCard(): ActivityProps | null {
  const load = useCallback(async () => {
    const deviceId = await getIosIdForVendorAsync();
    return deviceId ? fetchCard(deviceId) : null;
  }, []);
  return usePolling(load, null);
}
