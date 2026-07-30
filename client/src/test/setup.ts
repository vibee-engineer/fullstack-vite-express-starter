/**
 * Vitest setup — loaded before every client test file (see vitest.config.ts).
 *
 * Adds jest-dom's DOM matchers (`toBeInTheDocument`, `toBeDisabled`, ...) and
 * stubs the two browser APIs jsdom doesn't implement but Radix primitives call.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Unmount between tests. @testing-library/react only auto-registers its
 * cleanup when vitest `globals` are enabled; this config keeps globals off
 * (explicit imports), so wire it by hand — otherwise every render leaks into
 * the next test and queries start finding duplicate elements.
 */
afterEach(() => {
  cleanup();
});

// Radix (and any `useMediaQuery` consumer) calls matchMedia on mount.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Radix popper/scroll-lock paths touch these; jsdom ships neither.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
