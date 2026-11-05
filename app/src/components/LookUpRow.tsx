import type { NearbyPlane } from '@overhead/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { HorizonGauge } from '@/components/HorizonGauge';
import { lookUpGuide, tapsWhenFacing } from '@/lib/lookUp';
import { themedStyles, useColors } from '@/lib/theme';

const ARROW_PATH = 'M130 32 L162 112 L138 104 L138 196 L122 196 L122 104 L98 112 Z';
const DIAL_SIZE = 76;

export function LookUpRow({ plane, heading }: { plane: NearbyPlane; heading: number }) {
  const styles = useStyles();
  const colors = useColors();
  const guide = lookUpGuide(plane, heading);
  useTapWhenFacing(guide.facing);
  const pointerColor = guide.facing ? colors.success : colors.accent;

  return (
    <View style={styles.row}>
      <Svg
        width={DIAL_SIZE}
        height={DIAL_SIZE}
        viewBox="0 0 260 260"
        accessibilityLabel={
          guide.facing ? 'You are facing the plane' : `Arrow: ${guide.direction.toLowerCase()}`
        }
      >
        <Circle cx={130} cy={130} r={120} fill={colors.surface} stroke={pointerColor} strokeWidth={6} />
        <Line
          x1={130}
          y1={10}
          x2={130}
          y2={34}
          stroke={colors.textTertiary}
          strokeWidth={8}
          strokeLinecap="round"
        />
        <G transform={`rotate(${guide.arrowDeg} 130 130)`}>
          <Path d={ARROW_PATH} fill={pointerColor} />
        </G>
      </Svg>
      <View style={styles.text}>
        <Text style={[styles.title, { color: pointerColor }]}>
          {guide.facing ? 'You’re facing it' : guide.direction}
        </Text>
        <Text style={styles.hint}>
          {guide.facing ? 'Now look up' : 'Then look up'} {guide.elevationDeg}°
        </Text>
      </View>
      <HorizonGauge elevationDeg={guide.elevationDeg} color={pointerColor} />
    </View>
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

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    text: { flex: 1, gap: 2 },
    title: { fontSize: 18, fontWeight: '700' },
    hint: { color: colors.textSecondary, fontSize: 14 },
  }),
);
