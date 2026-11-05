import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FlightSummary } from '@/components/FlightCard';
import { Intro } from '@/components/Intro';
import { Screen } from '@/components/Screen';
import { SAMPLE_CARD, showSampleCard } from '@/live-activity/sampleCard';
import { themedStyles } from '@/lib/theme';

export default function WelcomeScreen() {
  const styles = useStyles();
  const [note, setNote] = useState<string>();

  const showSample = () =>
    setNote(
      showSampleCard()
        ? 'Lock your phone to see it. It goes away in 20 seconds.'
        : 'Live Activities are off for Overhead. Turn them on in iOS Settings.',
    );

  return (
    <Screen>
      <Card style={styles.sample}>
        <FlightSummary card={SAMPLE_CARD} label="Sample" />
      </Card>
      <Intro
        title="Planes above you, live"
        body="When a plane flies low over you, a card shows where it came from, where it’s going and where to look. It disappears once the plane is gone."
      />
      <View style={styles.spacer} />
      {note && <Text style={styles.note}>{note}</Text>}
      <Button label="Continue" onPress={() => router.push('/location')} />
      <Button label="Show it on my Lock Screen" variant="plain" onPress={showSample} />
    </Screen>
  );
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    sample: { marginTop: 28, marginHorizontal: 10, marginBottom: 12, transform: [{ rotate: '-3deg' }] },
    spacer: { flex: 1 },
    note: { color: colors.accent, fontSize: 15, textAlign: 'center' },
  }),
);
