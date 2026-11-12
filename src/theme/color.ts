/** `#rrggbb` plus alpha as an `rgba()` string, for ripples and overlays built from token colors. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`withAlpha needs #rrggbb, got ${hex}`);
  const [r, g, b] = m.slice(1).map(h => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
