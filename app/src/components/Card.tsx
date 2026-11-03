import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, themedStyles } from '@/lib/theme';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: 18,
      ...(colors.shadow && {
        shadowColor: '#000000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }),
    },
  }),
);
