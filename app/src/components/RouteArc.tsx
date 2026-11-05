import type { CardStage } from '@overhead/shared';
import Svg, { G, Path, Polyline } from 'react-native-svg';
import { arcPath, pointOnArc, ROUTE_PROGRESS } from '@/lib/routeArc';
import { PLANE_ICON } from '@/lib/planeIcon';
import { useColors } from '@/lib/theme';

const ARC = { width: 300, rise: 40 };
const PLANE_SIZE = 22;
const SAMPLES = 24;

export function RouteArc({ stage }: { stage: CardStage }) {
  const colors = useColors();
  const progress = ROUTE_PROGRESS[stage];
  const color = stage === 'passed' ? colors.textTertiary : colors.route;
  const plane = pointOnArc(progress, ARC);
  const travelled = Array.from({ length: SAMPLES + 1 }, (_, index) =>
    pointOnArc((progress * index) / SAMPLES, ARC),
  )
    .map(({ x, y }) => `${x},${y}`)
    .join(' ');

  return (
    <Svg
      width="100%"
      height={ARC.rise + 24}
      viewBox={`-12 -12 ${ARC.width + 24} ${ARC.rise + 24}`}
      accessibilityElementsHidden
    >
      <Path
        d={arcPath(ARC)}
        fill="none"
        stroke={colors.routeTrack}
        strokeWidth={2}
        strokeDasharray="1 5"
        strokeLinecap="round"
      />
      <Polyline points={travelled} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <G
        transform={`translate(${plane.x - PLANE_SIZE / 2} ${plane.y - PLANE_SIZE / 2}) rotate(${plane.headingDeg - PLANE_ICON.noseDeg} ${PLANE_SIZE / 2} ${PLANE_SIZE / 2}) scale(${PLANE_SIZE / PLANE_ICON.size})`}
      >
        <Path d={PLANE_ICON.path} fill={color} />
      </G>
    </Svg>
  );
}
