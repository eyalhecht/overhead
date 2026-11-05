import { createWatcher } from './activity/watcher.js';
import { createApp } from './api/app.js';
import { loadConfig } from './config.js';
import { createPositionSource } from './flights/positions.js';
import { createRouteSource } from './flights/routes.js';
import { createSky } from './flights/sky.js';
import { createApnsClient, createDryRunPushClient } from './push/apns.js';
import { createUserStore, memoryStorage, sqliteStorage } from './users.js';

const DRY_RUN_DEVICE = 'dry-run-device';

const config = loadConfig();
const users = createUserStore({
  storage: config.databasePath ? sqliteStorage(config.databasePath) : memoryStorage(),
});
const sky = createSky(createPositionSource(), createRouteSource({ fr24Token: config.fr24Token }));
const push = config.apns ? createApnsClient(config.apns) : createDryRunPushClient(simulateCardOpened);
const watcher = createWatcher({ users, sky, push, demoLocation: config.demoLocation });

const dryRunUser =
  !config.apns && config.demoLocation
    ? users.upsert({
        deviceId: DRY_RUN_DEVICE,
        ...config.demoLocation,
        startToken: DRY_RUN_DEVICE,
        activityTokens: [],
        quietHours: null,
        utcOffsetMinutes: 0,
      })
    : undefined;

function simulateCardOpened(): void {
  if (dryRunUser) void watcher.reportActivityTokens(dryRunUser, [`dry-run-card-${Date.now()}`]);
}

createApp({ appKey: config.appKey, users, watcher }).listen(config.port, () => {
  const mode = config.apns ? 'pushing to Apple' : 'dry run';
  const watching = config.demoLocation
    ? `demo spot ${config.demoLocation.lat},${config.demoLocation.lon}`
    : 'phone locations';
  console.log(`Overhead server on :${config.port}, ${mode}, watching ${watching}`);
});
watcher.start();

process.once('SIGTERM', () => {
  watcher.stop();
  users.close();
  process.exit(0);
});
