import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '@/lib/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'plain';
}

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [primary ? styles.primary : styles.plain, pressed && styles.pressed]}
    >
      <Text style={primary ? styles.primaryLabel : styles.plainLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  primaryLabel: { color: colors.background, fontSize: 17, fontWeight: '600' },
  plainLabel: { color: colors.accent, fontSize: 17, fontWeight: '600' },
});
