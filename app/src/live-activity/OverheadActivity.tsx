import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  opacity,
  padding,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers';
import type { Route } from '@overhead/shared';
import type { LiveActivityContent } from '@overhead/shared/cardText';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

const OverheadActivity = (props: LiveActivityContent, environment: LiveActivityEnvironment) => {
  'widget';

  const accent = environment.isLuminanceReduced
    ? '#FFFFFF'
    : environment.colorScheme === 'light'
      ? '#9A5900'
      : '#FFB340';
  const stage = environment.isStale ? 'passed' : props.stage;
  const status = environment.isStale ? 'Passed' : props.status;
  const details = props.details;

  const statusColor = stage === 'passed' ? '#8E8E93' : accent;
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
        <Image systemName="airplane" size={size * 0.6} color={statusColor} />
        <Spacer />
        {airport(route.to, route.toCity, 'trailing', size)}
      </HStack>
    ) : (
      <Text modifiers={[font({ size: size * 0.7, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.6)]}>
        {props.title}
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
          {detailsLine(20)}
        </VStack>
      ),
    };
  }

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 14 })]}>
        {statusRow(13)}
        {routeRow(props.route, 34)}
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

export default createLiveActivity<LiveActivityContent>('Overhead', OverheadActivity);
