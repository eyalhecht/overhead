import { Circle, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  clipped,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  offset,
  opacity,
  padding,
  rotationEffect,
  strokeBorder,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers';
import type { ActivityProps, Route } from '@overhead/shared';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

const OverheadActivity = (props: ActivityProps, environment: LiveActivityEnvironment) => {
  'widget';

  const light = environment.colorScheme === 'light';
  const pick = (lightColor: string, darkColor: string) =>
    environment.isLuminanceReduced ? '#FFFFFF' : light ? lightColor : darkColor;
  const accent = pick('#9A5900', '#FFB340');
  const stage = environment.isStale ? 'passed' : props.stage;
  const arcColor = stage === 'passed' ? '#8E8E93' : pick('#2F7DE1', '#409CFF');
  const status = { approaching: 'Approaching', overhead: 'Above you now', passed: 'Passed' }[stage];
  const details = [props.airline ?? props.flight, props.aircraft].filter(Boolean).join(' · ');

  const statusColor = stage === 'passed' ? arcColor : accent;
  const statusLine = (size: number) => (
    <HStack spacing={6} modifiers={[layoutPriority(1)]}>
      <Image systemName="airplane" size={size} color={statusColor} />
      <Text modifiers={[font({ size, weight: 'semibold' }), foregroundStyle(statusColor)]}>{status}</Text>
    </HStack>
  );

  const statusRow = (size: number) => (
    <HStack>
      {statusLine(size)}
      <Spacer />
      <Text modifiers={[font({ size, weight: 'semibold' }), opacity(0.6)]}>{props.flight}</Text>
    </HStack>
  );

  // The widget can't draw paths, so the route is the top of a big circle, cropped to a box.
  const routeArc = () => {
    const width = 300;
    const rise = 40;
    const radius = (width * width) / 8 / rise + rise / 2;
    const lineWidth = 2.5;
    const planeSize = 16;
    const top = planeSize / 2;
    const progress = { approaching: 0.32, overhead: 0.5, passed: 0.78 }[stage];
    const x = width * (progress - 0.5);
    const drop = radius - Math.sqrt(radius * radius - x * x);
    const headingDeg = (Math.atan2(x, radius - drop) * 180) / Math.PI;
    return (
      <ZStack alignment="top" modifiers={[frame({ width, height: top + rise + lineWidth }), clipped()]}>
        <Circle
          modifiers={[
            foregroundStyle('clear'),
            strokeBorder({ content: arcColor, style: { lineWidth }, shape: 'circle' }),
            frame({ width: radius * 2, height: radius * 2 }),
            offset({ y: top }),
          ]}
        />
        <Image
          systemName="airplane"
          size={planeSize}
          color={arcColor}
          modifiers={[
            rotationEffect(headingDeg),
            offset({ x, y: top + drop + lineWidth / 2 - planeSize / 2 }),
          ]}
        />
      </ZStack>
    );
  };

  const airport = (code: string, city: string, alignment: 'leading' | 'trailing', size: number) => (
    <VStack alignment={alignment} spacing={2}>
      <Text modifiers={[font({ size, weight: 'bold' })]}>{code}</Text>
      <Text modifiers={[font({ size: 13, weight: 'medium' }), opacity(0.6)]}>{city}</Text>
    </VStack>
  );

  const routeRow = (route: Route | null, size: number) =>
    route ? (
      <HStack>
        {airport(route.from, route.fromCity, 'leading', size)}
        <Spacer />
        {airport(route.to, route.toCity, 'trailing', size)}
      </HStack>
    ) : (
      <Text modifiers={[font({ size: size * 0.7, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.6)]}>
        Route unknown
      </Text>
    );

  const detailsLine = (size: number) => (
    <Text
      modifiers={[
        font({ size, weight: 'medium' }),
        opacity(0.6),
        lineLimit(1),
        minimumScaleFactor(0.8),
        truncationMode('tail'),
      ]}
    >
      {details}
    </Text>
  );

  if (environment.isActivityFullscreen) {
    return {
      banner: (
        <VStack spacing={16} modifiers={[padding({ all: 24 })]}>
          {statusRow(20)}
          {routeRow(props.route, 72)}
          {routeArc()}
          {detailsLine(20)}
        </VStack>
      ),
    };
  }

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        {statusRow(13)}
        {routeRow(props.route, 34)}
        <HStack>
          <Spacer />
          {routeArc()}
          <Spacer />
        </HStack>
        {detailsLine(13)}
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        <Image systemName="airplane" size={13} color={accent} />
        <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.route?.from ?? props.flight}</Text>
      </HStack>
    ),
    compactTrailing: (
      <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.route?.to ?? ''}</Text>
    ),
    minimal: <Image systemName="airplane" size={13} color={accent} />,
    expandedLeading: props.route
      ? airport(props.route.from, props.route.fromCity, 'leading', 30)
      : routeRow(null, 24),
    expandedTrailing: props.route ? airport(props.route.to, props.route.toCity, 'trailing', 30) : undefined,
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 12 })]}>
        {statusLine(13)}
        <Spacer />
        {detailsLine(13)}
      </HStack>
    ),
  };
};

export default createLiveActivity<ActivityProps>('Overhead', OverheadActivity);
