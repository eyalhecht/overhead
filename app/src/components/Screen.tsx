import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themedStyles } from '@/lib/theme';

interface ScreenProps {
  scrollable?: boolean;
  sheet?: boolean;
  style?: ViewStyle;
}

export function Screen({
  children,
  scrollable = false,
  sheet = false,
  style,
}: PropsWithChildren<ScreenProps>) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const inset = { paddingTop: (sheet ? 0 : insets.top) + 16, paddingBottom: insets.bottom + 24 };

  if (scrollable) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, inset, style]}>
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, styles.content, inset, style]}>{children}</View>;
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, paddingHorizontal: 18, gap: 16 },
  }),
);
