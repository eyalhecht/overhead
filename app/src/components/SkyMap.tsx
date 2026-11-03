import type { NearbyPlane } from '@overhead/shared';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { compassDirection, formatDistance } from '@/lib/format';
import { MAP, northLabelPosition, placePlane, PLANE_ICON, zoomFor } from '@/lib/skyMap';
import { colors } from '@/lib/theme';

const PATH_HALF_LENGTH = 400;
const LABELLED_RINGS = MAP.rings.slice(0, 2);
const { center } = MAP;

interface SkyMapProps {
  planes: NearbyPlane[];
  highlightedId?: string;
  heading: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function SkyMap({ planes, highlightedId, heading }: SkyMapProps) {
  const { stepKm, shown } = zoomFor(planes);
  const placed = shown.map((plane) => ({ plane, ...placePlane(plane, heading, stepKm) }));
  const north = northLabelPosition(heading);
  const highlighted = shown.find((plane) => plane.id === highlightedId);
  const label = highlighted
    ? `Map turned to where you face: ${highlighted.flight} ${formatDistance(highlighted.distanceNm)} ${compassDirection(highlighted.bearingDeg)} of you`
    : 'Map of the sky around you, no planes close';

  return (
    <Svg
      width={MAP.width}
      height={MAP.height}
      viewBox={`0 0 ${MAP.width} ${MAP.height}`}
      style={styles.map}
      accessibilityLabel={label}
    >
      {MAP.rings.map((ring, index) => (
        <Circle
          key={ring}
          cx={center.x}
          cy={center.y}
          r={ring * MAP.ringSpacingPx}
          fill="none"
          stroke={`rgba(255,255,255,${0.24 - index * 0.06})`}
        />
      ))}

      {placed.map(({ plane, x, y, rotation }) => {
        const dx = Math.sin(toRadians(rotation)) * PATH_HALF_LENGTH;
        const dy = -Math.cos(toRadians(rotation)) * PATH_HALF_LENGTH;
        return (
          <Line
            key={`path-${plane.id}`}
            x1={x - dx}
            y1={y - dy}
            x2={x + dx}
            y2={y + dy}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={2}
            strokeDasharray="5 6"
          />
        );
      })}

      <Path d="M150 100 L139 76 A26 26 0 0 1 161 76 Z" fill="rgba(255,255,255,0.16)" />
      {LABELLED_RINGS.map((ring) => (
        <SvgText
          key={ring}
          x={center.x}
          y={center.y + ring * MAP.ringSpacingPx + 3}
          textAnchor="middle"
          fontSize={10}
          fontWeight="600"
          fill={colors.textSecondary}
        >
          {`${ring * stepKm} km`}
        </SvgText>
      ))}
      <SvgText
        x={north.x}
        y={north.y + 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight="700"
        fill={colors.text}
      >
        N
      </SvgText>

      {placed.map(({ plane, x, y, rotation }) => (
        <G
          key={plane.id}
          transform={`translate(${x} ${y}) rotate(${rotation - PLANE_ICON.noseDeg}) translate(${-PLANE_ICON.size / 2} ${-PLANE_ICON.size / 2})`}
        >
          <Path
            d={PLANE_ICON.path}
            fill={colors.background}
            stroke={plane.id === highlightedId ? colors.accent : colors.textSecondary}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </G>
      ))}

      <Circle cx={center.x} cy={center.y} r={5} fill={colors.text} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  map: { alignSelf: 'center' },
});
