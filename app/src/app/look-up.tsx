import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { HorizonGauge } from '@/components/HorizonGauge';
import { Screen } from '@/components/Screen';
import { useSky } from '@/hooks/useSky';
import { cardDetails, cardTitle, formatAltitude, formatDistance } from '@/lib/format';
import { elevationHint, lookUpGuide, tapsWhenFacing } from '@/lib/lookUp';
import { colors, radius } from '@/lib/theme';

const ARROW_PATH = 'M130 32 L162 112 L138 104 L138 196 L122 196 L122 104 L98 112 Z';

export default function LookUpScreen() {
  const { card, cardPlane: plane, heading } = useSky();
  const guide = plane && lookUpGuide(plane, heading);
  useTapWhenFacing(guide?.facing ?? false);
  const pointerColor = guide?.facing ? colors.success : colors.accent;

  return (
    <Screen style={styles.centered}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>

      {card && plane && guide ? (
        <>
          <Text style={styles.eyebrow}>LOOK UP</Text>
          <Text style={styles.title}>{guide.direction}</Text>
          <Svg
            width={230}
            height={230}
            viewBox="0 0 260 260"
            accessibilityLabel={`Arrow pointing ${guide.direction.toLowerCase()}`}
          >
            <Circle
              cx={130}
              cy={130}
              r={120}
              fill="none"
              stroke={guide.facing ? colors.success : colors.ring}
              strokeOpacity={guide.facing ? 0.5 : 1}
              strokeWidth={2}
            />
            <Line
              x1={130}
              y1={6}
              x2={130}
              y2={22}
              stroke={colors.textTertiary}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <G transform={`rotate(${guide.arrowDeg} 130 130)`}>
              <Path d={ARROW_PATH} fill={pointerColor} />
            </G>
          </Svg>
          <View style={[styles.card, styles.elevation]}>
            <HorizonGauge elevationDeg={guide.elevationDeg} color={pointerColor} />
            <View style={styles.elevationText}>
              <Text style={styles.elevationAngle}>{guide.elevationDeg}° up</Text>
              <Text style={styles.cardText}>{elevationHint(guide.elevationDeg)}</Text>
            </View>
          </View>
          <View style={styles.spacer} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{cardTitle(card)}</Text>
            <Text style={styles.cardText}>
              {[
                cardDetails(card),
                `${formatDistance(plane.distanceNm)} away`,
                formatAltitude(plane.altitudeFt),
              ].join(' · ')}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.gone}>It’s gone. Planes pass fast!</Text>
      )}
    </Screen>
  );
}

function useTapWhenFacing(facing: boolean): void {
  const wasFacing = useRef(false);
  useEffect(() => {
    if (tapsWhenFacing(wasFacing.current, facing)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    wasFacing.current = facing;
  }, [facing]);
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center' },
  done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  doneLabel: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  eyebrow: { color: colors.accent, fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  spacer: { flex: 1 },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  cardText: { color: colors.textSecondary, fontSize: 15 },
  elevation: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  elevationText: { flex: 1, gap: 2 },
  elevationAngle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  gone: { color: colors.textSecondary, fontSize: 17, marginTop: 120 },
});
