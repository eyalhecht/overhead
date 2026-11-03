import { describe, expect, it } from 'vitest';
import { palettes, type Palette } from './palettes';

const SMALL_TEXT = 4.5;
const GRAPHICS = 3;

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe.each(Object.entries(palettes) as [string, Palette][])('the %s palette', (_, colors) => {
  it.each(['background', 'surface'] as const)('keeps every kind of text readable on the %s', (layer) => {
    for (const text of ['text', 'textSecondary', 'accent', 'success'] as const) {
      expect(contrast(colors[text], colors[layer])).toBeGreaterThanOrEqual(SMALL_TEXT);
    }
  });

  it('keeps the route line and its plane visible on a card', () => {
    expect(contrast(colors.route, colors.surface)).toBeGreaterThanOrEqual(GRAPHICS);
  });

  it('keeps button labels readable', () => {
    expect(contrast(colors.buttonText, colors.button)).toBeGreaterThanOrEqual(SMALL_TEXT);
  });
});
