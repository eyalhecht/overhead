import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  task: undefined as undefined | ((body: { data?: unknown; error?: unknown }) => Promise<void>),
  started: false,
  backgroundGranted: true,
}));

vi.mock('expo-task-manager', () => ({
  defineTask: (_name: string, task: typeof native.task) => {
    native.task = task;
  },
}));

vi.mock('expo-location', () => ({
  Accuracy: { Low: 2, Balanced: 3 },
  requestForegroundPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestBackgroundPermissionsAsync: vi.fn(async () => ({ granted: native.backgroundGranted })),
  hasStartedLocationUpdatesAsync: vi.fn(async () => native.started),
  startLocationUpdatesAsync: vi.fn(async () => {
    native.started = true;
  }),
  stopLocationUpdatesAsync: vi.fn(),
}));

vi.mock('./checkIn', () => ({ checkIn: vi.fn(async () => {}) }));

const Location = await import('expo-location');
const { checkIn } = await import('./checkIn');
const { requestLocationAccess } = await import('./location');

const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });

describe('background location with the app closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.started = false;
    native.backgroundGranted = true;
  });

  it('checks in with the newest location iOS delivers to the closed app', async () => {
    await native.task!({ data: { locations: [fix(32.064, 34.836), fix(32.047, 34.82)] } });
    expect(checkIn).toHaveBeenCalledWith({ lat: 32.047, lon: 34.82 });
  });

  it('ignores a background wake-up that brings an error or no location', async () => {
    await native.task!({ error: new Error('denied') });
    await native.task!({ data: { locations: [] } });
    expect(checkIn).not.toHaveBeenCalled();
  });

  it('asks iOS for about 100 m accuracy every 200 m, with nothing held back', async () => {
    await requestLocationAccess();
    const [, options] = vi.mocked(Location.startLocationUpdatesAsync).mock.calls[0]!;
    expect(options).toMatchObject({ accuracy: Location.Accuracy.Balanced, distanceInterval: 200 });
    expect(options).not.toHaveProperty('deferredUpdatesDistance');
  });

  it('starts background updates once, and only with Always access', async () => {
    await requestLocationAccess();
    await requestLocationAccess();
    native.started = false;
    native.backgroundGranted = false;
    await requestLocationAccess();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });
});
