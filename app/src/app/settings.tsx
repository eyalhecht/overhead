import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useSettings } from '@/hooks/useSettings';
import { colors, radius } from '@/lib/theme';
import type { Settings } from '@/services/settings';

const OPTIONS: { key: keyof Settings; label: string; help?: string }[] = [
  { key: 'liveActivities', label: 'Show Live Activity' },
  { key: 'quietHours', label: 'Quiet hours, 22:00 to 07:00', help: 'No Live Activities while you sleep.' },
];

export default function SettingsScreen() {
  const { settings, update } = useSettings();

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        Settings
      </Text>

      {settings &&
        OPTIONS.map(({ key, label, help }) => (
          <View key={key} style={styles.option}>
            <View style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Switch
                value={settings[key]}
                onValueChange={(value) => update({ [key]: value })}
                accessibilityLabel={label}
                trackColor={{ true: colors.success }}
              />
            </View>
            {help && <Text style={styles.help}>{help}</Text>}
          </View>
        ))}

      <View style={styles.spacer} />
      <Text style={styles.help}>Only a location rounded to about 100 m leaves your phone.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  doneLabel: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  option: { gap: 8 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { color: colors.text, fontSize: 17, flex: 1 },
  help: { color: colors.textSecondary, fontSize: 13, marginHorizontal: 16 },
  spacer: { flex: 1 },
});
