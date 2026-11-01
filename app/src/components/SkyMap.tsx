import type { NearbyPlane } from '@overhead/shared';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { compassDirection, formatDistance, KM_PER_NM } from '@/lib/format';
import { colors } from '@/lib/theme';

const WIDTH = 300;
const HEIGHT = 200;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const PX_PER_KM = 32;
const RING_RADII = [32, 64, 96];
const LABELLED_RINGS = RING_RADII.slice(0, 2);
const PATH_HALF_LENGTH = 400;
const PLANE_ICON_TILT = 45;
const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';

interface SkyMapProps {
  planes: NearbyPlane[];
  highlightedId?: string;
  heading: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function screenPosition(plane: NearbyPlane, heading: number) {
  const angle = toRadians(plane.bearingDeg - heading);
  const distance = plane.distanceNm * KM_PER_NM * PX_PER_KM;
  return {
    x: CENTER.x + distance * Math.sin(angle),
    y: CENTER.y - distance * Math.cos(angle),
    rotation: plane.trackDeg - heading,
  };
}

export function SkyMap({ planes, highlightedId, heading }: SkyMapProps) {
  const highlighted = planes.find((plane) => plane.id === highlightedId);
  const north = toRadians(-heading);
  const placed = planes.map((plane) => ({ plane, ...screenPosition(plane, heading) }));
  const label = highlighted
    ? `Map turned to where you face: ${highlighted.flight} ${formatDistance(highlighted.distanceNm)} ${compassDirection(highlighted.bearingDeg)} of you`
    : 'Map of the sky around you, no planes close';

  return (
    <Svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={styles.map}
      accessibilityLabel={label}
    >
      {RING_RADII.map((radius, index) => (
        <Circle
          key={radius}
          cx={CENTER.x}
          cy={CENTER.y}
          r={radius}
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
      {LABELLED_RINGS.map((radius) => (
        <SvgText
          key={radius}
          x={CENTER.x}
          y={CENTER.y + radius + 3}
          textAnchor="middle"
          fontSize={10}
          fontWeight="600"
          fill={colors.textSecondary}
        >
          {`${radius / PX_PER_KM} km`}
        </SvgText>
      ))}
      <SvgText
        x={CENTER.x + 96 * Math.sin(north)}
        y={CENTER.y + 4 - 96 * Math.cos(north)}
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
          transform={`translate(${x} ${y}) rotate(${rotation - PLANE_ICON_TILT}) translate(-12 -12)`}
        >
          <Path
            d={PLANE_PATH}
            fill={colors.background}
            stroke={plane.id === highlightedId ? colors.accent : colors.textSecondary}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </G>
      ))}

      <Circle cx={CENTER.x} cy={CENTER.y} r={5} fill={colors.text} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  map: { alignSelf: 'center' },
});
