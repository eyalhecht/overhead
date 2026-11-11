import { clockTime, QUIET_HOURS } from '@overhead/shared/rules';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useSettings } from '@/hooks/useSettings';
import { themedStyles, useColors } from '@/lib/theme';
import { deleteMyData } from '@/services/myData';
import type { Settings } from '@/services/settings';

const OPTIONS: { key: keyof Settings; label: string; help: string }[] = [
  {
    key: 'liveActivities',
    label: 'Show on Lock Screen',
    help: 'A card when a plane passes over you',
  },
  {
    key: 'quietHours',
    label: 'Quiet hours',
    help: `${QUIET_HOURS.map(clockTime).join(' to ')}, no cards while you sleep`,
  },
];

export default function SettingsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { settings, update } = useSettings();

  return (
    <Screen sheet>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        Settings
      </Text>

      {settings &&
        OPTIONS.map(({ key, label, help }) => (
          <Card key={key} style={styles.option}>
            <View style={styles.optionText}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.help}>{help}</Text>
            </View>
            <Switch
              value={settings[key]}
              onValueChange={(value) => update({ [key]: value })}
              accessibilityLabel={label}
              trackColor={{ true: colors.success }}
            />
          </Card>
        ))}

      <View style={styles.spacer} />
      <Button label="Delete my data" variant="plain" onPress={confirmDeletion} />
      <Text style={styles.footnote}>Only a location rounded to about 100 m leaves your phone.</Text>
    </Screen>
  );
}

function confirmDeletion(): void {
  Alert.alert(
    'Delete my data?',
    'Overhead’s server and this phone forget your location, settings and cards right away. You can start again any time.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteAndStartOver() },
    ],
  );
}

async function deleteAndStartOver(): Promise<void> {
  try {
    await deleteMyData();
    router.dismissAll();
    router.replace('/welcome');
  } catch {
    Alert.alert('Could not delete your data', 'Check your connection and try again.');
  }
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
    doneLabel: { color: colors.accent, fontSize: 17, fontWeight: '600' },
    title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
    option: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    optionText: { flex: 1, gap: 2 },
    label: { color: colors.text, fontSize: 17, fontWeight: '600' },
    help: { color: colors.textSecondary, fontSize: 14 },
    spacer: { flex: 1 },
    footnote: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  }),
);
