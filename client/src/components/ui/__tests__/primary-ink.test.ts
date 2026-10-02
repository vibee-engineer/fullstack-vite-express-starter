import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Brand-coloured TEXT and icons use `text-primary-ink`, never the `--primary` FILL.
 *
 * `bg-primary/10 text-primary` (active sidebar item, StatCard/EmptyState icon
 * tiles, command palette) put the fill on a 10% tint of itself: 30 of 46 theme
 * modes across 24 real founding.dev apps were under WCAG AA 4.5:1 there, most
 * near 2.7. `--primary-ink` is the same hue solved for text (the Material 3
 * on-primary-container / Radix step-11 role). The token generator solves it per
 * app; the starter default equals --primary, which already passes.
 */
const SRC = join(__dirname, '..', '..', '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

// Controls whose indicator pairs with border-primary are fills, not text.
const FILL_OK = new Set(['radio-group.tsx']);

describe('primary ink', () => {
  it('no component paints text with the --primary fill', () => {
    const offenders = files(SRC)
      .filter((f) => !FILL_OK.has(f.split('/').pop()!))
      .flatMap((f) => {
        const src = readFileSync(f, 'utf8');
        return [...src.matchAll(/(?<![\w-])text-primary(?![\w-])/g)].map(() =>
          f.replace(SRC, 'src'),
        );
      });
    expect(offenders).toEqual([]);
  });

  it('tailwind maps text-primary-ink, falling back to --primary for older token files', () => {
    const cfg = readFileSync(join(SRC, '..', 'tailwind.config.ts'), 'utf8');
    expect(cfg).toMatch(/ink:\s*'hsl\(var\(--primary-ink, var\(--primary\)\)\)'/);
  });

  it('tokens.css defines --primary-ink in both themes', () => {
    const css = readFileSync(join(SRC, 'tokens.css'), 'utf8');
    expect(css.match(/--primary-ink:/g)?.length).toBe(2);
  });
});
