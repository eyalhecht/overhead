import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configWarnings, loadConfig } from '../src/config.js';

const keyPath = join(mkdtempSync(join(tmpdir(), 'overhead-config-')), 'apns.p8');
writeFileSync(keyPath, 'test key');

const PUSHING_TO_APPLE = {
  APNS_KEY_PATH: keyPath,
  APNS_KEY_ID: 'KEY',
  APNS_TEAM_ID: 'TEAM',
  APNS_BUNDLE_ID: 'com.example.overhead',
};

describe('config', () => {
  it('ignores the demo spot when pushing to Apple, so real phones watch their own sky', () => {
    const config = loadConfig({ ...PUSHING_TO_APPLE, DEMO_LAT: '51.47', DEMO_LON: '-0.45' });
    expect(config.demoLocation).toBeUndefined();
  });

  it('keeps the demo spot for a dry run', () => {
    expect(loadConfig({ DEMO_LAT: '51.47', DEMO_LON: '-0.45' }).demoLocation).toEqual({
      lat: 51.47,
      lon: -0.45,
    });
  });

  it('warns when pushing to Apple without an app key or a database', () => {
    expect(configWarnings(loadConfig(PUSHING_TO_APPLE))).toHaveLength(2);
    expect(
      configWarnings(loadConfig({ ...PUSHING_TO_APPLE, APP_KEY: 'key', DATABASE_PATH: 'overhead.db' })),
    ).toEqual([]);
  });

  it('does not warn during a dry run', () => {
    expect(configWarnings(loadConfig({}))).toEqual([]);
  });
});
