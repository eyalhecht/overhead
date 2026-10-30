import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { useSky } from '@/hooks/useSky';
import {
  describeDirection,
  elevationAngle,
  formatAltitude,
  formatCountdown,
  formatDistance,
  relativeBearing,
} from '@/lib/format';
import { colors, radius } from '@/lib/theme';

const ALIGNED_WITHIN_DEG = 10;
const ARROW_PATH = 'M130 32 L162 112 L138 104 L138 196 L122 196 L122 104 L98 112 Z';

export default function LookUpScreen() {
  const { routedPlanes, heading } = useSky();
  const plane = routedPlanes[0];
  const relative = plane ? relativeBearing(plane.bearingDeg, heading) : 0;
  const aligned = plane !== undefined && Math.abs(relative) < ALIGNED_WITHIN_DEG;
  useHapticOnAlign(aligned);

  return (
    <Screen style={styles.centered}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>

      {plane ? (
        <>
          <Text style={styles.eyebrow}>LOOK UP</Text>
          <Text style={styles.title}>
            {describeDirection(relative)},{'\n'}
            {elevationAngle(plane.altitudeFt, plane.distanceNm)}° above the horizon
          </Text>
          <Svg
            width={240}
            height={240}
            viewBox="0 0 260 260"
            accessibilityLabel={`Arrow pointing ${describeDirection(relative).toLowerCase()}`}
          >
            <Circle cx={130} cy={130} r={120} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2} />
            <Line
              x1={130}
              y1={6}
              x2={130}
              y2={22}
              stroke={colors.textTertiary}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <G transform={`rotate(${relative} 130 130)`}>
              <Path d={ARROW_PATH} fill={aligned ? colors.success : colors.accent} />
            </G>
          </Svg>
          <View style={styles.spacer} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {plane.route.from} → {plane.route.to}
            </Text>
            <Text style={styles.cardText}>
              {[
                plane.flight,
                `${formatDistance(plane.distanceNm)} away`,
                formatAltitude(plane.altitudeFt),
                `~${formatCountdown(plane.secondsLeft)} left`,
              ].join(' · ')}
            </Text>
          </View>
          <Text style={styles.hint}>
            Turn until the arrow points straight up. You’ll feel a tap when you’re facing it.
          </Text>
        </>
      ) : (
        <Text style={styles.gone}>It’s gone. Planes pass fast!</Text>
      )}
    </Screen>
  );
}

function useHapticOnAlign(aligned: boolean): void {
  const wasAligned = useRef(false);
  useEffect(() => {
    if (aligned && !wasAligned.current) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    wasAligned.current = aligned;
  }, [aligned]);
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center' },
  done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  doneLabel: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  eyebrow: { color: colors.accent, fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', textAlign: 'center' },
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
  hint: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  gone: { color: colors.textSecondary, fontSize: 17, marginTop: 120 },
});
