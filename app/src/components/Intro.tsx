import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

interface IntroProps {
  title: string;
  body: string;
}

export function Intro({ title, body }: IntroProps) {
  return (
    <View style={styles.intro}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, marginTop: 56 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: 17, lineHeight: 24 },
});
