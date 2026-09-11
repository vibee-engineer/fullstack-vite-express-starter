import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Read the raw CSS text. `?raw` is unreliable here (the Vite CSS plugin claims
// .css imports first), so read from disk. vitest's cwd is the client workspace,
// but tolerate the monorepo root too.
const candidates = ['src/index.css', 'client/src/index.css'].map((p) => resolve(process.cwd(), p));
const cssPath = candidates.find((p) => existsSync(p));
if (!cssPath) throw new Error(`index.css not found from ${process.cwd()}`);
const css = readFileSync(cssPath, 'utf8');

/**
 * Regression guard for the "Inter/Inter template tell".
 *
 * tokens.css defines a distinct --font-display (e.g. Space Grotesk) separate
 * from --font-body (Inter). But that display face only renders if something
 * APPLIES it. The base layer in index.css must set font-family: var(--font-display)
 * on headings — otherwise headings inherit --font-body and every heading renders
 * in the body font, making the app look like an untouched template. This test
 * fails if that rule is ever removed.
 */

describe('index.css base typography', () => {
  it('applies the display font to headings so --font-display is not dead', () => {
    // Normalize whitespace so selector-list formatting does not matter.
    const flat = css.replace(/\s+/g, ' ');
    // A rule whose selector list includes h1 and whose body sets the display font.
    const rule = /h1[^{}]*\{[^}]*font-family:\s*var\(--font-display\)/i;
    expect(flat).toMatch(rule);
  });

  it('keeps negative heading tracking (the art-directed craft detail)', () => {
    const flat = css.replace(/\s+/g, ' ');
    expect(flat).toMatch(/h1\s*\{[^}]*letter-spacing:\s*-0?\.0\d+em/i);
  });
});
