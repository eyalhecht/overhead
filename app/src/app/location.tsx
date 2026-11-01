import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Intro } from '@/components/Intro';
import { Screen } from '@/components/Screen';
import { useSky } from '@/hooks/useSky';
import { colors } from '@/lib/theme';
import { completeOnboarding } from '@/services/onboarding';

const PROMISES = [
  { title: 'Rough, not exact', text: 'Only a location rounded to about 100 m leaves your phone.' },
  {
    title: 'Almost no battery',
    text: 'The phone only checks in after you move about 500 m. No GPS running in the background.',
  },
  { title: 'Never shared', text: 'Used only to match planes to you. Never shown to anyone, never sold.' },
];

export default function LocationScreen() {
  const { requestAccess } = useSky();

  const finish = async (askForLocation: boolean) => {
    if (askForLocation) await requestAccess();
    await completeOnboarding();
    router.replace('/');
  };

  return (
    <Screen>
      <Intro
        title="Overhead needs your location"
        body="To know when a plane is above you, even while the app is closed. Choose “Always Allow” when iOS asks."
      />
      {PROMISES.map(({ title, text }) => (
        <View key={title}>
          <Text style={styles.promiseTitle}>{title}</Text>
          <Text style={styles.promiseText}>{text}</Text>
        </View>
      ))}
      <View style={styles.spacer} />
      <Button label="Allow location" onPress={() => void finish(true)} />
      <Button label="Not now" variant="plain" onPress={() => void finish(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  promiseTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  promiseText: { color: colors.textSecondary, fontSize: 15, marginTop: 2 },
  spacer: { flex: 1 },
});
