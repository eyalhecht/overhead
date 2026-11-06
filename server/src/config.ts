import { readFileSync } from 'node:fs';
import type { GeoPoint } from '@overhead/shared';
import { z } from 'zod';

const optionalString = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional());
const optionalNumber = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().optional(),
);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  APP_KEY: optionalString,
  FR24_TOKEN: optionalString,
  APNS_KEY_PATH: optionalString,
  APNS_KEY_ID: optionalString,
  APNS_TEAM_ID: optionalString,
  APNS_BUNDLE_ID: optionalString,
  APNS_HOST: z.string().default('api.push.apple.com'),
  DATABASE_PATH: optionalString,
  DEMO_LAT: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  DEMO_LON: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
});

export interface ApnsConfig {
  privateKey: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  host: string;
}

export interface Config {
  port: number;
  appKey?: string;
  fr24Token?: string;
  databasePath?: string;
  apns?: ApnsConfig;
  demoLocation?: GeoPoint;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  const apns = apnsConfig(parsed);
  return {
    port: parsed.PORT,
    appKey: parsed.APP_KEY,
    fr24Token: parsed.FR24_TOKEN,
    databasePath: parsed.DATABASE_PATH,
    apns,
    demoLocation:
      !apns && parsed.DEMO_LAT !== undefined && parsed.DEMO_LON !== undefined
        ? { lat: parsed.DEMO_LAT, lon: parsed.DEMO_LON }
        : undefined,
  };
}

export function configWarnings({ apns, appKey, databasePath }: Config): string[] {
  if (!apns) return [];
  return [
    ...(appKey ? [] : ['APP_KEY is not set, so anyone can call the API']),
    ...(databasePath ? [] : ['DATABASE_PATH is not set, so a restart forgets every phone']),
  ];
}

function apnsConfig(env: z.infer<typeof EnvSchema>): ApnsConfig | undefined {
  const { APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_HOST } = env;
  const provided = [APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID].filter(Boolean).length;
  if (provided === 0) return undefined;
  if (!APNS_KEY_PATH || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID) {
    throw new Error(
      'APNs config is incomplete: set APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID and APNS_BUNDLE_ID',
    );
  }
  return {
    privateKey: readFileSync(APNS_KEY_PATH, 'utf8'),
    keyId: APNS_KEY_ID,
    teamId: APNS_TEAM_ID,
    bundleId: APNS_BUNDLE_ID,
    host: APNS_HOST,
  };
}
