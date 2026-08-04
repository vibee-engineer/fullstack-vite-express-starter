/**
 * token-config-wiring.test.ts — tailwind.config.ts must CONSUME what tokens.css emits.
 *
 * The primitives were the wrong place to look for "the tokens don't reach the
 * UI". tailwind.config.ts is the choke point, and it was discarding three
 * whole token families that the emitter was producing correctly:
 *
 *   RADIUS  tokens.css ships --radius-sm/md/lg as three independent brand values
 *           (measured: 6/10/14px). The config derived them arithmetically from a
 *           single --radius: md = radius - 2px, lg = radius. So a brand asking
 *           for 6/10/14 rendered 6/8/10 and two of its three steps were gone.
 *
 *   FONTS   tokens.css ships --font-display and --font-body from the generated
 *           brand (e.g. Sora / IBM Plex Sans). The config pinned sans, heading
 *           and body all to a hardcoded Inter, so the chosen typography reached
 *           no rendered element at all — half the brand, discarded one line
 *           above the colours that were wired correctly.
 *
 *   MOTION  tokens.css ships --dur-fast/base/slow (Carbon's productive set) and
 *           --ease-out/--ease-in-out. No utility mapped to any of them, so every
 *           transition used Tailwind's default 150ms/ease.
 *
 * Verified in a browser after the fix: rounded-sm/md/lg computed 6px/10px/14px,
 * font-heading computed Sora, font-body computed IBM Plex Sans, and
 * duration-fast/ease-out computed 0.1s / cubic-bezier(0.165, 0.84, 0.44, 1).
 *
 * Every mapping keeps a fallback INSIDE the var() so a tokens.css written before
 * these tokens existed still resolves rather than collapsing to nothing.
 */
import { describe, expect, test } from 'vitest';

import config from '../../../../tailwind.config';

const extend = (config.theme as Record<string, any>).extend as Record<string, any>;

describe('borderRadius consumes the emitted ladder', () => {
  test.each([
    ['sm', '--radius-sm'],
    ['md', '--radius-md'],
    ['lg', '--radius-lg'],
  ])('rounded-%s reads %s', (key, token) => {
    expect(extend.borderRadius[key]).toContain(`var(${token}`);
  });

  test('no step is derived by arithmetic off a single --radius', () => {
    // `calc(var(--radius) - 2px)` may appear only as the FALLBACK inside the
    // var(), never as the whole value — that is what threw the ladder away.
    for (const key of ['sm', 'md', 'lg']) {
      const v: string = extend.borderRadius[key];
      expect(v.startsWith('var(--radius-')).toBe(true);
    }
  });

  test('each step keeps a fallback for a pre-ladder tokens.css', () => {
    for (const key of ['sm', 'md', 'lg']) {
      expect(extend.borderRadius[key]).toMatch(/var\(--radius-[a-z]+,\s*.+\)/);
    }
  });
});

describe('fontFamily consumes the brand typefaces', () => {
  test('body text uses --font-body, not a hardcoded family', () => {
    expect(extend.fontFamily.sans[0]).toContain('var(--font-body');
    expect(extend.fontFamily.body[0]).toContain('var(--font-body');
  });

  test('headings use --font-display', () => {
    expect(extend.fontFamily.heading[0]).toContain('var(--font-display');
    // `display` is an alias so an agent writing font-display gets the right
    // family instead of silently falling through to the body font.
    expect(extend.fontFamily.display[0]).toContain('var(--font-display');
  });

  test('no family is pinned to a bare hardcoded typeface', () => {
    for (const key of ['sans', 'heading', 'display', 'body']) {
      expect(extend.fontFamily[key][0]).not.toBe('Inter');
    }
  });

  test('Inter survives only as the in-var fallback', () => {
    // Keeping it means a brand that returns no typography still renders in
    // something deliberate rather than the browser default serif.
    expect(extend.fontFamily.sans[0]).toMatch(/var\(--font-body,\s*Inter\)/);
  });

  test('mono stays a real stack — no token exists for it', () => {
    // Asserted so nobody "fixes" this into a var that tokens.css never emits,
    // which would resolve to nothing and fall back to the browser default.
    expect(extend.fontFamily.mono[0]).toBe('ui-monospace');
  });
});

describe('motion tokens are reachable as utilities', () => {
  test.each([
    ['fast', '--dur-fast'],
    ['base', '--dur-base'],
    ['slow', '--dur-slow'],
  ])('duration-%s reads %s', (key, token) => {
    expect(extend.transitionDuration[key]).toContain(`var(${token}`);
  });

  test.each([
    ['out', '--ease-out'],
    ['in-out', '--ease-in-out'],
  ])('ease-%s reads %s', (key, token) => {
    expect(extend.transitionTimingFunction[key]).toContain(`var(${token}`);
  });

  test('the accordion animation uses the tokens, not a hardcoded 0.2s ease-out', () => {
    for (const key of ['accordion-down', 'accordion-up']) {
      const v: string = extend.animation[key];
      expect(v).toContain('var(--dur-slow');
      expect(v).toContain('var(--ease-out');
      expect(v).not.toMatch(/\b0\.2s\s+ease-out\b/);
    }
  });
});
