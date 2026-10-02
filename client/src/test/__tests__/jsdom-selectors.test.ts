/**
 * Floating UI (every Popover, Select, DropdownMenu, Tooltip, DatePicker) calls
 * `el.matches(':modal')` on each position pass. nwsapi 2.2.27 answered it by
 * calling `matches` again from inside itself (:modal -> :fullscreen -> matches
 * -> ...) until the stack overflowed and a try/catch swallowed it: 16M nested
 * calls and ~5 s of CPU to open ONE popover, so any test that opened one blew
 * the 5 s timeout. 2.2.28 added a re-entrancy guard. Keep nwsapi >= 2.2.28.
 */
import { describe, expect, it } from 'vitest';

describe('jsdom selector engine', () => {
  it('answers :modal without re-entering matches()', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const native = Element.prototype.matches;
    let calls = 0;
    Element.prototype.matches = function (this: Element, selector: string) {
      calls++;
      return native.call(this, selector);
    };
    try {
      expect(el.matches(':modal')).toBe(false);
    } finally {
      Element.prototype.matches = native;
      el.remove();
    }
    expect(calls).toBeLessThan(10); // broken engine: thousands
  });
});
