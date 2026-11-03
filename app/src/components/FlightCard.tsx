import type { ActivityProps, NearbyPlane } from '@overhead/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  cardDetails,
  cardTitle,
  compassDirection,
  describeStage,
  formatAltitude,
  formatDistance,
} from '@/lib/format';
import { colors } from '@/lib/theme';

interface FlightCardProps {
  card: ActivityProps;
  plane?: NearbyPlane;
  onPress: () => void;
}

export function FlightCard({ card, plane, onPress }: FlightCardProps) {
  const position =
    plane &&
    [
      compassDirection(plane.bearingDeg),
      formatDistance(plane.distanceNm),
      formatAltitude(plane.altitudeFt),
    ].join(' · ');

  return (
    <Pressable
      style={styles.card}
      accessibilityRole="button"
      accessibilityHint="Shows where to look"
      onPress={onPress}
    >
      <Text style={styles.status}>{describeStage(card.stage)}</Text>
      {card.route ? (
        <View style={styles.route}>
          <Airport code={card.route.from} city={card.route.fromCity} />
          <Text style={styles.arrow} accessibilityLabel="to">
            →
          </Text>
          <Airport code={card.route.to} city={card.route.toCity} alignEnd />
        </View>
      ) : (
        <Text style={styles.unknownRoute}>{cardTitle(card)}</Text>
      )}
      <Text style={styles.details}>{cardDetails(card)}</Text>
      {position && <Text style={styles.details}>{position}</Text>}
      {card.stage !== 'passed' && <Text style={styles.hint}>Tap to see where to look</Text>}
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
  unknownRoute: { color: colors.text, fontSize: 28, fontWeight: '700' },
  details: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  hint: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
