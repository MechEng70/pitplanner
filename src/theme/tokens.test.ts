// The tokens must equal the values the 0.2.0 kit took from the mockups (legacy/src/ui/ui.css).
// When legacy/ is deleted (T-039), move these expectations to a frozen copy of the values first.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwindConfig from '../../tailwind.config.js';
import { withAlpha } from './color';
import { chipHintSize, colors, lineHeightRatio, radii, relaxedLineHeightRatio, statusColors, type } from './tokens';

const css = readFileSync(join(__dirname, '../../legacy/src/ui/ui.css'), 'utf8');
const camel = (kebab: string) => kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): Record<string, string> {
  const m = new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`no rule ${selector} in ui.css`);
  return Object.fromEntries(
    m[2]
      .split(';')
      .map(d => d.split(':').map(x => x.trim()))
      .filter(([k, v]) => k && v && !k.startsWith('/*')),
  );
}

test('every ui.css color variable is a token with the same value, and nothing extra', () => {
  const root = rule(':root');
  const cssColors = Object.fromEntries(
    Object.entries(root)
      .filter(([k]) => k.startsWith('--') && !k.startsWith('--ease'))
      .map(([k, v]) => [camel(k.slice(2)), v]),
  );
  expect(colors).toEqual(cssColors);
});

test('the type scale matches the ui.css .t-* classes (size, weight, line height)', () => {
  for (const [name, t] of Object.entries(type)) {
    const r = rule(`.t-${name}`);
    expect([name, `${t.size}px`, t.weight]).toEqual([name, r['font-size'], r['font-weight'] ?? '400']);
    expect([name, 'lh' in t ? String(t.lh) : String(lineHeightRatio)]).toEqual([name, r['line-height'] ?? '1.25']);
  }
  expect(rule('body')['line-height']).toBe(String(lineHeightRatio));
});

test('status container colors match the ui.css components that write them as literals', () => {
  expect(statusColors.okContainer).toBe(rule('.avatar-ok').background);
  expect(statusColors.warnContainer).toBe(rule('.status-warn').background);
  expect(statusColors.warnContainer).toBe(rule('.banner-warn').background);
  expect(statusColors.goldContainer).toBe(rule('.avatar-gold').background);
  expect(statusColors.errorContainer).toBe(rule('.status-error').background);
  expect(statusColors.errorContainer).toBe(rule('.banner-error').background);
  expect(statusColors.onErrorContainer).toBe(rule('.banner-error').color);
});

test('relaxed line height and the chip hint size match ui.css', () => {
  expect(String(relaxedLineHeightRatio)).toBe(rule('.lh')['line-height']);
  expect(String(relaxedLineHeightRatio)).toBe(rule('.infobox')['line-height']);
  expect(`${chipHintSize}px`).toBe(rule('.chip-hint')['font-size']);
});

test('radii match the ui.css components they are named for', () => {
  const r = (sel: string) => rule(sel)['border-radius'];
  expect(`${radii.statusDot}px`).toBe(r('.status-dot'));
  expect(`${radii.small}px`).toBe(r('.when-btn'));
  expect(`${radii.inset}px`).toBe(r('.chips-s .chip'));
  expect(`${radii.control}px`).toBe(r('.tile'));
  expect(`${radii.card}px`).toBe(r('.card'));
  expect(`${radii.pill}px`).toBe(r('.btn-outline'));
  expect(`${radii.search}px`).toBe(r('.search'));
  expect(`${radii.primary}px`).toBe(r('.btn-primary'));
});

test('the Tailwind theme exposes every token color (incl. status containers), and only token colors', () => {
  const theme = tailwindConfig.theme as { colors: object; fontSize: object };
  const flat = (o: object): string[] =>
    Object.values(o).flatMap(v => (typeof v === 'string' ? [v] : flat(v as object)));
  const themeColors = new Set(flat(theme.colors));
  themeColors.delete('transparent');
  const tokenColors = new Set<string>([...Object.values(colors), ...Object.values(statusColors)]);
  expect([...tokenColors].filter(c => !themeColors.has(c))).toEqual([]);
  expect([...themeColors].filter(c => !tokenColors.has(c))).toEqual([]);
  expect(Object.keys(theme.fontSize).sort()).toEqual(Object.keys(type).sort());
});

test('withAlpha turns a token hex into rgba', () => {
  expect(withAlpha(colors.accent, 0.16)).toBe('rgba(255, 143, 74, 0.16)');
  expect(() => withAlpha('orange', 1)).toThrow();
});
