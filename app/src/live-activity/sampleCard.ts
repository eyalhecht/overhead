import OverheadActivity from './OverheadActivity';

const SAMPLE_DURATION_MS = 20_000;

export function showSampleCard(): boolean {
  try {
    const card = OverheadActivity.start({
      from: 'LHR',
      fromCity: 'London',
      to: 'BER',
      toCity: 'Berlin',
      flight: 'BA 982',
      aircraft: 'A320neo',
      altitudeFt: 3400,
      endsAt: Date.now() + SAMPLE_DURATION_MS,
      more: 0,
    });
    setTimeout(() => void card.end('immediate').catch(() => undefined), SAMPLE_DURATION_MS);
    return true;
  } catch {
    return false;
  }
}
