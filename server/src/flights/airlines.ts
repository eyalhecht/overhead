import { AIRLINE_CALLSIGN } from '@overhead/shared/rules';
import airlineNames from './airlines.json' with { type: 'json' };

const names: Record<string, string> = airlineNames;

export function airlineName(callsign: string): string | undefined {
  const code = AIRLINE_CALLSIGN.exec(callsign)?.[1];
  return code ? names[code] : undefined;
}
