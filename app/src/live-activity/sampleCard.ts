import type { ActivityProps } from '@overhead/shared';
import OverheadActivity from './OverheadActivity';

const SAMPLE_DURATION_MS = 20_000;

export const SAMPLE_CARD: ActivityProps = {
  flight: 'BAW982',
  airline: 'British Airways',
  aircraft: 'A320neo',
  route: { from: 'LHR', fromCity: 'London', to: 'BER', toCity: 'Berlin' },
  stage: 'overhead',
};

export function showSampleCard(): boolean {
  try {
    const card = OverheadActivity.start(SAMPLE_CARD);
    setTimeout(() => void card.end('immediate').catch(() => undefined), SAMPLE_DURATION_MS);
    return true;
  } catch {
    return false;
  }
}
