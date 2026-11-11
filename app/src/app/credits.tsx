import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { themedStyles } from '@/lib/theme';

const SOURCES: { what: string; credit: string; url: string }[] = [
  {
    what: 'Aircraft positions',
    credit: 'FlyItalyADSB (flyitalyadsb.com), licensed CC BY-SA 4.0, filtered by Overhead.',
    url: 'https://flyitalyadsb.com/terms/',
  },
  {
    what: 'Backup positions',
    credit: 'Contains information from adsb.lol, made available under the Open Database License (ODbL).',
    url: 'https://www.adsb.lol/docs/open-data/api/',
  },
  {
    what: 'Routes',
    credit: 'Virtual Radar Server standing data, public domain (CC0).',
    url: 'https://github.com/vradarserver/standing-data',
  },
  {
    what: 'Airline names',
    credit: 'Contains information from OpenFlights, made available under the Open Database License (ODbL).',
    url: 'https://openflights.org/data.php',
  },
  {
    what: 'Airports',
    credit: 'OurAirports, public domain.',
    url: 'https://ourairports.com/data/',
  },
  {
    what: 'Loudness',
    credit: 'Estimated from EASA aircraft noise data with the ECAC Doc 29 method.',
    url: 'https://www.easa.europa.eu/en/domains/environment/policy-support-and-research/aircraft-noise-and-performance-anp-data',
  },
];

export default function CreditsScreen() {
  const styles = useStyles();

  return (
    <Screen sheet>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Credits
        </Text>
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>
            For curiosity only. Flight data comes from volunteers and third parties, can be late or wrong, and
            must not be used for navigation or safety. Loudness is an estimate, not a measurement.
          </Text>
        </Card>
        {SOURCES.map(({ what, credit, url }) => (
          <Pressable key={what} accessibilityRole="link" onPress={() => void Linking.openURL(url)}>
            <Card style={styles.source}>
              <Text style={styles.what}>{what}</Text>
              <Text style={styles.credit}>{credit}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
    doneLabel: { color: colors.accent, fontSize: 17, fontWeight: '600' },
    content: { gap: 12, paddingBottom: 24 },
    title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
    notice: { backgroundColor: colors.accentSoft },
    noticeText: { color: colors.text, fontSize: 15, lineHeight: 21 },
    source: { gap: 4 },
    what: { color: colors.text, fontSize: 17, fontWeight: '600' },
    credit: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  }),
);
