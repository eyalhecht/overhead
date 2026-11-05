import type { RegisterRequest, SkySnapshot } from '@overhead/shared';
import { roughLocation } from '@overhead/shared/rules';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:8080';
const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? '';

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-app-key': APP_KEY },
  });
  if (!response.ok) throw new Error(`Server responded ${response.status} for ${path}`);
  return response;
}

export async function register(body: RegisterRequest): Promise<void> {
  await request('/register', { method: 'POST', body: JSON.stringify({ ...body, ...roughLocation(body) }) });
}

export async function fetchSky(deviceId: string): Promise<SkySnapshot> {
  const response = await request(`/sky?deviceId=${encodeURIComponent(deviceId)}`);
  return (await response.json()) as SkySnapshot;
}
