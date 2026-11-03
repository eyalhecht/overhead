import '@/services/location';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SkyProvider } from '@/hooks/useSky';
import { useColors } from '@/lib/theme';
import { startCheckInService } from '@/services/checkIn';

startCheckInService();

export default function RootLayout() {
  const colors = useColors();
  return (
    <SkyProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="look-up" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </SkyProvider>
  );
}
