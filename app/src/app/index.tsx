import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FlightCard } from '@/components/FlightCard';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SkyMap } from '@/components/SkyMap';
import { useSky } from '@/hooks/useSky';
import { themedStyles, useColors } from '@/lib/theme';
import { isOnboarded } from '@/services/onboarding';

export default function HomeScreen() {
  const styles = useStyles();
  const colors = useColors();
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
            <Icon name="settings" color={colors.text} />
          </Pressable>
        </Link>
      </View>

      {card ? (
        <FlightCard card={card} plane={cardPlane} />
      ) : permission === 'denied' ? (
        <Card style={styles.message}>
          <View style={styles.messageIcon}>
            <Icon name="pin" color={colors.accent} size={26} />
          </View>
          <Text style={styles.messageTitle}>Location is off</Text>
          <Text style={styles.messageText}>So Overhead can’t find planes above you.</Text>
          <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : (
        <View style={styles.waiting}>
          <Text style={styles.messageTitle}>
            {location ? 'Waiting for the next plane' : 'Finding your location…'}
          </Text>
          {location && (
            <Text style={styles.messageText}>
              It will show up here and on your Lock Screen the moment one comes close.
            </Text>
          )}
        </View>
      )}

      {permission !== 'denied' && (
        <Card style={styles.map}>
          <SkyMap planes={planes} highlightedId={cardPlane?.id} heading={heading} />
        </Card>
      )}
    </Screen>
  );
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    map: { paddingHorizontal: 6, paddingVertical: 14 },
    message: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    messageIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    messageTitle: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    messageText: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 21,
      textAlign: 'center',
      marginBottom: 6,
    },
    waiting: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderRadius: 26,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.routeTrack,
    },
  }),
);
