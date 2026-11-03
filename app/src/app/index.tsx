import { Link, Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button } from '@/components/Button';
import { FlightCard } from '@/components/FlightCard';
import { Screen } from '@/components/Screen';
import { SkyMap } from '@/components/SkyMap';
import { useSky } from '@/hooks/useSky';
import { colors } from '@/lib/theme';
import { isOnboarded } from '@/services/onboarding';

export default function HomeScreen() {
  const [onboarded, setOnboarded] = useState<boolean>();
  const { permission, location, heading, planes, card, cardPlane } = useSky();

  useEffect(() => {
    void isOnboarded().then(setOnboarded);
  }, []);

  if (onboarded === undefined) return <Screen />;
  if (!onboarded) return <Redirect href="/welcome" />;

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Overhead
        </Text>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={styles.settingsButton}>
            <SettingsIcon />
          </Pressable>
        </Link>
      </View>

      <SkyMap planes={planes} highlightedId={cardPlane?.id} heading={heading} />

      {card ? (
        <FlightCard card={card} plane={cardPlane} onPress={() => router.push('/look-up')} />
      ) : permission === 'denied' ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Location is off, so Overhead can’t find planes above you.</Text>
          <Button label="Open Settings" variant="plain" onPress={() => void Linking.openSettings()} />
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {location ? 'No planes above you right now.' : 'Finding your location…'}
        </Text>
      )}
    </Screen>
  );
}

function SettingsIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2}>
      <Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" strokeLinecap="round" />
      <Circle cx={16} cy={6} r={2} />
      <Circle cx={10} cy={12} r={2} />
      <Circle cx={18} cy={18} r={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  settingsButton: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  empty: { gap: 8 },
  emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
});
