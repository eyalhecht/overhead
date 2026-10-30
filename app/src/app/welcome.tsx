import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { showSampleCard } from '@/live-activity/sampleCard';
import { colors } from '@/lib/theme';

export default function WelcomeScreen() {
  const [note, setNote] = useState<string>();

  const showSample = () =>
    setNote(
      showSampleCard()
        ? 'Lock your phone to see it. It goes away in 20 seconds.'
        : 'Live Activities are off for Overhead. Turn them on in iOS Settings.',
    );

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          Planes above you, live
        </Text>
        <Text style={styles.body}>
          When a plane flies low over you, Overhead shows where it came from and where it’s going, right on
          your Lock Screen. It disappears the moment the plane is gone.
        </Text>
      </View>
      <View style={styles.spacer} />
      {note && <Text style={styles.note}>{note}</Text>}
      <Button label="Show a sample on my Lock Screen" onPress={showSample} />
      <Button label="Continue" variant="plain" onPress={() => router.push('/location')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, marginTop: 56 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: 17, lineHeight: 24 },
  spacer: { flex: 1 },
  note: { color: colors.accent, fontSize: 15, textAlign: 'center' },
});
