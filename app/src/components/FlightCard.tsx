import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoutedPlane } from '@/hooks/useSky';
import { compassDirection, formatAltitude, formatCountdown, formatDistance } from '@/lib/format';
import { colors, radius } from '@/lib/theme';

interface FlightCardProps {
  main: RoutedPlane;
  second?: RoutedPlane;
  onPress: () => void;
}

export function FlightCard({ main, second, onPress }: FlightCardProps) {
  const status = main.rare
    ? `RARE · ${main.rare}`
    : second
      ? '2 planes above you now'
      : `Above you now · ~${formatCountdown(main.secondsLeft)} left`;
  const details = [
    compassDirection(main.bearingDeg),
    formatDistance(main.distanceNm),
    formatAltitude(main.altitudeFt),
    second ? `~${formatCountdown(main.secondsLeft)} left` : main.flight,
  ].join(' · ');

  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityHint="Shows where to look"
      onPress={onPress}
    >
      <Text style={styles.status}>{status}</Text>
      <View style={styles.route}>
        <Airport code={main.route.from} city={main.route.fromCity} />
        <Text style={styles.arrow} accessibilityLabel="to">
          →
        </Text>
        <Airport code={main.route.to} city={main.route.toCity} alignEnd />
      </View>
      <Text style={styles.details}>{details}</Text>

      {second && (
        <View style={styles.secondPlane}>
          <Text style={styles.secondRoute}>
            {second.route.from} → {second.route.to}
          </Text>
          <Text style={styles.details}>
            {compassDirection(second.bearingDeg)} · {formatDistance(second.distanceNm)} · ~
            {formatCountdown(second.secondsLeft)}
          </Text>
        </View>
      )}

      <Text style={styles.hint}>Tap to see where to look</Text>
    </Pressable>
  );
}

function Airport({ code, city, alignEnd = false }: { code: string; city: string; alignEnd?: boolean }) {
  return (
    <View style={alignEnd && styles.alignEnd}>
      <Text style={styles.code}>{code}</Text>
      <Text style={styles.city}>{city}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, alignItems: 'center' },
  status: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  alignEnd: { alignItems: 'flex-end' },
  code: { color: colors.text, fontSize: 48, fontWeight: '700' },
  city: { color: colors.textSecondary, fontSize: 15, fontWeight: '500' },
  arrow: { color: colors.textTertiary, fontSize: 24 },
  details: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  secondPlane: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondRoute: { color: colors.text, fontSize: 17, fontWeight: '600' },
  hint: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
