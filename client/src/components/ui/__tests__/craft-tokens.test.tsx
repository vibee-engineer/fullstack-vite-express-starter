/**
 * craft-tokens.test.tsx — primitives must CONSUME the design tokens.
 *
 * WHY THIS EXISTS
 * ===============
 * tokens.css can ship a perfect design system and change nothing, because what
 * users see is whatever the primitives actually reference. That was the real
 * state of things: the token emitter was upgraded with a surface ladder, an
 * elevation ladder, a radius ladder and motion tokens, and every app still
 * looked identical, because Card was hardcoded to
 * `border border-border shadow-sm` and Button to `rounded-md transition-colors`.
 *
 * Measured on a shipped app before this: one border colour across 140 elements,
 * one radius, two identical surfaces, and 14 elements with any transition.
 *
 * These tests assert the wiring, not the appearance. They fail if a primitive
 * goes back to a hardcoded border, a uniform radius, or no motion.
 */
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Button } from '../button';
import { Card } from '../card';
import { Input } from '../input';

const classesOf = (el: Element | null) => (el?.getAttribute('class') ?? '');

describe('Card', () => {
  const cardClasses = () => {
    const { container } = render(<Card>content</Card>);
    return classesOf(container.firstElementChild);
  };

  test('draws its hairline as a ring, not a border', () => {
    const c = cardClasses();
    // --elevation-card is PRE-COMPOSED: hairline ring + one elevation step in a
    // single var. It has to be one var because Tailwind cannot parse a top-level
    // comma in an arbitrary value — shadow-[var(--a),var(--b)] compiles to no
    // rule at all, which is exactly how this shipped broken once.
    expect(c).toContain('var(--elevation-card)');
    // A border participates in layout and double-draws the edge alongside a
    // shadow. Geist ships borders as shadows for exactly this reason.
    expect(c).not.toMatch(/(^|\s)border(\s|$)/);
    expect(c).not.toContain('border-border');
  });

  test('carries one step of elevation from the ladder', () => {
    expect(cardClasses()).toContain('var(--elevation-card)');
  });

  test('takes its radius from the ladder, not a single uniform value', () => {
    const c = cardClasses();
    expect(c).toContain('var(--radius-lg)');
    // Tailwind's own rounded-md/xl would bypass the ladder.
    expect(c).not.toMatch(/rounded-(?:md|xl|lg)(\s|$)/);
  });

  test('sits on --card, which is no longer the page background', () => {
    expect(cardClasses()).toContain('bg-card');
  });
});

describe('Button', () => {
  const btnClasses = (props = {}) => {
    const { container } = render(<Button {...props}>go</Button>);
    return classesOf(container.querySelector('button'));
  };

  test('uses the control radius, not the card radius', () => {
    const c = btnClasses();
    expect(c).toContain('var(--radius-sm)');
    expect(c).not.toMatch(/rounded-md(\s|$)/);
  });

  test('animates with the motion tokens', () => {
    const c = btnClasses();
    expect(c).toContain('var(--dur-fast)');
    expect(c).toContain('var(--ease-out)');
  });

  test('never uses transition-all', () => {
    // transition-all animates layout properties and drops frames.
    expect(btnClasses()).not.toContain('transition-all');
  });

  test('has a press affordance', () => {
    expect(btnClasses()).toContain('active:translate-y-');
  });

  test('the primary variant carries the inset highlight', () => {
    // Linear's inset top edge: the highest "designed" signal per line of CSS.
    expect(btnClasses()).toContain('var(--shadow-button)');
  });

  test('the outline variant uses a ring rather than a border', () => {
    const c = btnClasses({ variant: 'outline' });
    expect(c).toContain('var(--elevation-flat)');
    expect(c).not.toMatch(/(^|\s)border(\s|$)/);
  });

  test('focus ring is :focus-visible only', () => {
    const c = btnClasses();
    expect(c).toContain('focus-visible:ring-2');
    // A ring on plain :focus fires for mouse clicks too, which reads as a bug.
    expect(c).not.toMatch(/(^|\s)focus:ring/);
  });

  test('every size clears the 24x24 WCAG 2.2 SC 2.5.8 (AA) minimum', () => {
    // h-9 = 36px, h-10 = 40px, h-11 = 44px, icon is 40x40. All well clear.
    for (const size of ['default', 'sm', 'lg', 'icon'] as const) {
      const c = btnClasses({ size });
      const m = /h-(\d+)/.exec(c);
      expect(m).not.toBeNull();
      const rem = m ? Number(m[1]) : 0;
      expect(rem * 4).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('Input', () => {
  test('uses a ring hairline and the control radius', () => {
    const { container } = render(<Input />);
    const c = classesOf(container.querySelector('input'));
    expect(c).toContain('var(--elevation-flat)');
    expect(c).toContain('var(--radius-sm)');
    expect(c).not.toMatch(/(^|\s)border(\s|$)/);
  });
});
