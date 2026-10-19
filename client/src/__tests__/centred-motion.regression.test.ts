import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression: dialogs flew in from the bottom-right corner and left the same way.
 *
 * On Tailwind v3 the centring of a `fixed left-1/2 top-1/2 -translate-x-1/2
 * -translate-y-1/2` element lives in `transform`. tailwindcss-animate's
 * enter/exit keyframes REPLACE `transform` for the length of the animation, so
 * for every frame of the open and close the -50%/-50% offset is gone and the
 * panel's top-left corner sits at the viewport centre. shadcn's v3 registry
 * compensates by animating FROM/TO that same offset; the v4 registry dropped
 * those classes (v4 centres with the `translate` property, which the keyframes
 * do not touch) and this starter had copied the v4 strings onto v3.
 *
 * Measured before the fix at 1440x900: first open frame centred at (976,502)
 * and mid-close at (928,492) against a viewport centre of (720,450). After it,
 * within 3 px on every frame.
 */
const UI_DIR = join(__dirname, '..', 'components', 'ui');

const COMPENSATION = [
  'data-[state=open]:slide-in-from-left-1/2',
  'data-[state=open]:slide-in-from-top-[48%]',
  'data-[state=closed]:slide-out-to-left-1/2',
  'data-[state=closed]:slide-out-to-top-[48%]',
];

/** Every quoted class string in a file that centres with translate AND animates. */
function centredAnimatedClassStrings(source: string): string[] {
  const strings = source.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? [];
  return strings.filter(
    (s) =>
      /-translate-x-1\/2/.test(s) &&
      /-translate-y-1\/2/.test(s) &&
      /\banimate-(in|out)\b/.test(s),
  );
}

describe('centred overlays keep their centre while animating (Tailwind v3)', () => {
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith('.tsx'));
  const offenders = files.flatMap((f) =>
    centredAnimatedClassStrings(readFileSync(join(UI_DIR, f), 'utf8')).map((s) => ({ f, s })),
  );

  it('finds the centred primitives (the scan itself still works)', () => {
    const names = new Set(offenders.map((o) => o.f));
    expect(names.has('dialog.tsx')).toBe(true);
    expect(names.has('alert-dialog.tsx')).toBe(true);
  });

  it.each(COMPENSATION)('every centred animated primitive carries %s', (cls) => {
    const missing = offenders.filter((o) => !o.s.includes(cls)).map((o) => o.f);
    expect(missing).toEqual([]);
  });
});
