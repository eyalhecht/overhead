export interface Palette {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  ring: string;
  accent: string;
  accentSoft: string;
  success: string;
  route: string;
  routeTrack: string;
  button: string;
  buttonText: string;
  mapFan: string;
  shadow: boolean;
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    text: '#111114',
    textSecondary: '#6A6A70',
    textTertiary: '#AEAEB2',
    separator: '#E5E5EA',
    ring: '#E5E5EA',
    accent: '#9A5900',
    accentSoft: '#FFF1DB',
    success: '#167A3B',
    route: '#2F7DE1',
    routeTrack: '#C7C7CC',
    button: '#111114',
    buttonText: '#FFFFFF',
    mapFan: 'rgba(0,0,0,0.06)',
    shadow: true,
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#A1A1A8',
    textTertiary: '#636366',
    separator: '#38383A',
    ring: '#38383A',
    accent: '#FFB340',
    accentSoft: 'rgba(255,179,64,0.16)',
    success: '#30D158',
    route: '#409CFF',
    routeTrack: '#48484A',
    button: '#FFFFFF',
    buttonText: '#000000',
    mapFan: 'rgba(255,255,255,0.12)',
    shadow: false,
  },
};
