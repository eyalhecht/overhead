import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'settings' | 'pin' | 'target' | 'battery' | 'lock';

export function Icon({ name, color, size = 20 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[name]}
    </Svg>
  );
}

const SHAPES: Record<IconName, React.ReactNode> = {
  settings: (
    <>
      <Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <Circle cx={16} cy={6} r={2} />
      <Circle cx={10} cy={12} r={2} />
      <Circle cx={18} cy={18} r={2} />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <Circle cx={12} cy={9.5} r={2.5} />
    </>
  ),
  target: (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={2} />
    </>
  ),
  battery: (
    <>
      <Rect x={3} y={7} width={16} height={10} rx={2} />
      <Path d="M22 11v2M7 10v4" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};
