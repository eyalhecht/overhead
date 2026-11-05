import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useSettings } from '@/hooks/useSettings';
import { themedStyles, useColors } from '@/lib/theme';
import type { Settings } from '@/services/settings';

const OPTIONS: { key: keyof Settings; label: string; help: string }[] = [
  {
    key: 'liveActivities',
    label: 'Show on Lock Screen',
    help: 'A card when a plane passes over you',
  },
  { key: 'quietHours', label: 'Quiet hours', help: '22:00 to 07:00, no cards while you sleep' },
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
      <Text style={styles.footnote}>Only a location rounded to about 100 m leaves your phone.</Text>
    </Screen>
  );
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
