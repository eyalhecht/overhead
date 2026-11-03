import { StyleSheet, Text, View } from 'react-native';
import { themedStyles } from '@/lib/theme';

interface IntroProps {
  title: string;
  body: string;
}

export function Intro({ title, body }: IntroProps) {
  const styles = useStyles();
  return (
    <View style={styles.intro}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    intro: { gap: 12 },
    title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
    body: { color: colors.textSecondary, fontSize: 17, lineHeight: 24 },
  }),
);
