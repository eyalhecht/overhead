import { useColorScheme } from 'react-native';
import { palettes, type Palette } from './palettes';

export type { Palette };

export const radius = {
  card: 26,
  button: 18,
} as const;

export function useColors(): Palette {
  return palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function themedStyles<Styles>(build: (colors: Palette) => Styles): () => Styles {
  const built = new Map<Palette, Styles>();
  return function useThemedStyles() {
    const colors = useColors();
    if (!built.has(colors)) built.set(colors, build(colors));
    return built.get(colors) as Styles;
  };
}
