import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Intro } from '@/components/Intro';
import { Screen } from '@/components/Screen';
import { useSky } from '@/hooks/useSky';
import { themedStyles, useColors } from '@/lib/theme';
import { completeOnboarding } from '@/services/onboarding';

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'target',
    title: 'Rough, not exact',
    text: 'Only a location rounded to about 100 m leaves your phone.',
  },
  {
    icon: 'battery',
    title: 'Almost no battery',
    text: 'The phone only checks in after you move about 500 m. No GPS running in the background.',
  },
  {
    icon: 'lock',
    title: 'Never shared',
    text: 'Used only to match planes to you. Never shown to anyone, never sold.',
  },
];

export default function LocationScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { requestAccess } = useSky();

  const finish = async () => {
    await requestAccess();
    await completeOnboarding();
    router.replace('/');
  };

  return (
    <Screen>
      <View style={styles.top} />
      <Intro
        title="Overhead needs your location"
        body="To know when a plane is above you, even while the app is closed."
      />
      {PROMISES.map(({ icon, title, text }) => (
        <Card key={title} style={styles.promise}>
          <View style={styles.promiseIcon}>
            <Icon name={icon} color={colors.accent} />
          </View>
          <View style={styles.promiseText}>
            <Text style={styles.promiseTitle}>{title}</Text>
            <Text style={styles.promiseBody}>{text}</Text>
          </View>
        </Card>
      ))}
      <View style={styles.spacer} />
      <Button label="Continue" onPress={() => void finish()} />
    </Screen>
  );
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    top: { height: 12 },
    promise: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    promiseIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promiseText: { flex: 1, gap: 2 },
    promiseTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    promiseBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    spacer: { flex: 1 },
  }),
);
