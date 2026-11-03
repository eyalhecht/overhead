import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, themedStyles } from '@/lib/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'plain';
}

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  const styles = useStyles();
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

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    primary: {
      height: 54,
      borderRadius: radius.button,
      backgroundColor: colors.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plain: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.7 },
    primaryLabel: { color: colors.buttonText, fontSize: 17, fontWeight: '600' },
    plainLabel: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  }),
);
