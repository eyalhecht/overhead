import type { ActivityProps, NearbyPlane } from '@overhead/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card } from '@/components/Card';
import { RouteArc } from '@/components/RouteArc';
import {
  cardDetails,
  cardTitle,
  compassDirection,
  describeStage,
  formatAltitude,
  formatDistance,
} from '@/lib/format';
import { PLANE_ICON } from '@/lib/skyMap';
import { themedStyles, useColors } from '@/lib/theme';

interface FlightCardProps {
  card: ActivityProps;
  plane?: NearbyPlane;
  onPress: () => void;
}

export function FlightCard({ card, plane, onPress }: FlightCardProps) {
  const styles = useStyles();
  const position =
    plane &&
    [
      compassDirection(plane.bearingDeg),
      formatDistance(plane.distanceNm),
      formatAltitude(plane.altitudeFt),
    ].join(' · ');

  return (
    <Pressable accessibilityRole="button" accessibilityHint="Shows where to look" onPress={onPress}>
      <Card>
        <FlightSummary card={card} />
        {position && <Text style={styles.details}>{position}</Text>}
      </Card>
    </Pressable>
  );
}

export function FlightSummary({ card, label }: { card: ActivityProps; label?: string }) {
  const styles = useStyles();
  const colors = useColors();
  const statusColor = card.stage === 'passed' ? colors.textSecondary : colors.accent;

  return (
    <View style={styles.summary}>
      <View style={styles.header}>
        <View style={styles.status}>
          <Svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            style={{ transform: [{ rotate: `${90 - PLANE_ICON.noseDeg}deg` }] }}
          >
            <Path d={PLANE_ICON.path} fill={statusColor} />
          </Svg>
          <Text style={[styles.statusText, { color: statusColor }]}>{describeStage(card.stage)}</Text>
        </View>
        <Text style={styles.details}>{label ?? card.flight}</Text>
      </View>
      {card.route ? (
        <View style={styles.codes}>
          <Airport code={card.route.from} city={card.route.fromCity} />
          <Airport code={card.route.to} city={card.route.toCity} alignEnd />
        </View>
      ) : (
        <Text style={styles.unknownRoute}>{cardTitle(card)}</Text>
      )}
      <RouteArc stage={card.stage} />
      <Text style={styles.details}>{cardDetails(card)}</Text>
    </View>
  );
}

function Airport({ code, city, alignEnd = false }: { code: string; city: string; alignEnd?: boolean }) {
  const styles = useStyles();
  return (
    <View style={alignEnd && styles.alignEnd}>
      <Text style={styles.code}>{code}</Text>
      <Text style={styles.city}>{city}</Text>
    </View>
  );
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    summary: { gap: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusText: { fontSize: 14, fontWeight: '600' },
    codes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    alignEnd: { alignItems: 'flex-end' },
    code: { color: colors.text, fontSize: 44, fontWeight: '700', letterSpacing: -1 },
    city: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    unknownRoute: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: 6 },
    details: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', marginTop: 2 },
  }),
);
