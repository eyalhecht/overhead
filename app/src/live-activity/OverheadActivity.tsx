import { Divider, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, monospacedDigit, opacity, padding } from '@expo/ui/swift-ui/modifiers';
import type { ActivityProps } from '@overhead/shared';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

const OverheadActivity = (props: ActivityProps, environment: LiveActivityEnvironment) => {
  'widget';

  const accent = environment.isLuminanceReduced
    ? '#FFFFFF'
    : environment.colorScheme === 'light'
      ? '#A85F00'
      : '#FFB340';
  const details = [props.flight, props.aircraft, `${props.altitudeFt} ft`].filter(Boolean).join(' · ');

  const countdown = (size: number) => (
    <Text
      timerInterval={{ lower: new Date(), upper: new Date(props.endsAt) }}
      countsDown
      modifiers={[font({ size, weight: 'semibold' }), monospacedDigit()]}
    />
  );

  const airport = (code: string, city: string, alignment: 'leading' | 'trailing', size: number) => (
    <VStack alignment={alignment} spacing={2}>
      <Text modifiers={[font({ size, weight: 'bold' })]}>{code}</Text>
      <Text modifiers={[font({ size: 13, weight: 'medium' }), opacity(0.6)]}>{city}</Text>
    </VStack>
  );

  const rareLine = props.rare ? (
    <HStack spacing={8}>
      <Text modifiers={[font({ size: 11, weight: 'heavy' }), foregroundStyle(accent)]}>RARE</Text>
      <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(accent)]}>{props.rare}</Text>
    </HStack>
  ) : null;

  const secondLine = props.second ? (
    <HStack spacing={6}>
      <Image systemName="airplane" size={12} />
      <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>
        {`${props.second.from} → ${props.second.to}`}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), opacity(0.6)]}>
        {props.more > 0 ? `${props.second.flight} · +${props.more}` : props.second.flight}
      </Text>
    </HStack>
  ) : null;

  if (environment.isActivityFullscreen) {
    return {
      banner: (
        <VStack spacing={12} modifiers={[padding({ all: 24 })]}>
          <HStack>
            <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(accent)]}>
              Above you now
            </Text>
            <Spacer />
            {rareLine ?? (
              <Text modifiers={[font({ size: 17, weight: 'semibold' }), opacity(0.6)]}>{details}</Text>
            )}
          </HStack>
          <HStack alignment="lastTextBaseline">
            {airport(props.from, props.fromCity, 'leading', 72)}
            <Spacer />
            {countdown(44)}
            <Spacer />
            {airport(props.to, props.toCity, 'trailing', 72)}
          </HStack>
        </VStack>
      ),
    };
  }

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={6}>
          <Image systemName="airplane" size={14} color={accent} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(accent)]}>
            {environment.isStale ? 'Passed' : 'Above you now'}
          </Text>
          <Spacer />
          <Image systemName="timer" size={13} />
          {countdown(13)}
        </HStack>
        <HStack>
          {airport(props.from, props.fromCity, 'leading', 34)}
          <Spacer />
          <Image systemName="airplane" size={20} color={accent} />
          <Spacer />
          {airport(props.to, props.toCity, 'trailing', 34)}
        </HStack>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), opacity(0.6)]}>{details}</Text>
        {rareLine}
        {secondLine ? <Divider /> : null}
        {secondLine}
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        <Image systemName="airplane" size={13} color={accent} />
        <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.from}</Text>
      </HStack>
    ),
    compactTrailing: (
      <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>
        {props.second ? `${props.to} +${1 + props.more}` : props.to}
      </Text>
    ),
    minimal: <Image systemName="airplane" size={13} color={accent} />,
    expandedLeading: airport(props.from, props.fromCity, 'leading', 30),
    expandedTrailing: airport(props.to, props.toCity, 'trailing', 30),
    expandedBottom: (
      <VStack spacing={8}>
        <HStack>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), opacity(0.6)]}>{details}</Text>
          <Spacer />
          {countdown(13)}
        </HStack>
        {secondLine}
      </VStack>
    ),
  };
};

export default createLiveActivity<ActivityProps>('Overhead', OverheadActivity);
