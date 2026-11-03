import type { ActivityProps, GeoPoint, NearbyPlane, RegisterRequest } from '@overhead/shared';

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
  await request('/register', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchPlanesAbove({ lat, lon }: GeoPoint): Promise<NearbyPlane[]> {
  const response = await request(`/planes?lat=${lat}&lon=${lon}`);
  return (await response.json()) as NearbyPlane[];
}

export async function fetchCard(deviceId: string): Promise<ActivityProps | null> {
  const response = await request(`/card?deviceId=${encodeURIComponent(deviceId)}`);
  return (await response.json()) as ActivityProps | null;
}
