import { useCallback, useEffect, useState } from 'react';
import { loadSettings, onSettingsChange, saveSettings, type Settings } from '@/services/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>();

  useEffect(() => {
    void loadSettings().then(setSettings);
    return onSettingsChange(setSettings);
  }, []);

  const update = useCallback(
    (changes: Partial<Settings>) => {
      if (settings) void saveSettings({ ...settings, ...changes });
    },
    [settings],
  );

  return { settings, update };
}
