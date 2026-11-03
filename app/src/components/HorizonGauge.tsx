import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useColors } from '@/lib/theme';

const SIZE = 84;
const ORIGIN = { x: 8, y: 76 };
const RADIUS = 64;

interface HorizonGaugeProps {
  elevationDeg: number;
  color: string;
}

export function HorizonGauge({ elevationDeg, color }: HorizonGaugeProps) {
  const colors = useColors();
  const radians = (elevationDeg * Math.PI) / 180;
  const tip = { x: ORIGIN.x + RADIUS * Math.cos(radians), y: ORIGIN.y - RADIUS * Math.sin(radians) };

  return (
    <Svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      accessibilityLabel={`${elevationDeg} degrees above the horizon`}
    >
      <Path
        d={`M${ORIGIN.x} ${ORIGIN.y} A${RADIUS} ${RADIUS} 0 0 1 ${ORIGIN.x + RADIUS} ${ORIGIN.y - RADIUS}`}
        fill="none"
        stroke={colors.ring}
        strokeWidth={2}
      />
      <Line
        x1={ORIGIN.x}
        y1={ORIGIN.y}
        x2={SIZE - 4}
        y2={ORIGIN.y}
        stroke={colors.textTertiary}
        strokeWidth={2}
      />
      <Line
        x1={ORIGIN.x}
        y1={ORIGIN.y}
        x2={tip.x}
        y2={tip.y}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx={tip.x} cy={tip.y} r={5} fill={color} />
    </Svg>
  );
}
