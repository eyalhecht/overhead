import '@/services/location';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SkyProvider } from '@/hooks/useSky';
import { colors } from '@/lib/theme';
import { startCheckInService } from '@/services/checkIn';

startCheckInService();

export default function RootLayout() {
  return (
    <SkyProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="look-up" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </SkyProvider>
  );
}
