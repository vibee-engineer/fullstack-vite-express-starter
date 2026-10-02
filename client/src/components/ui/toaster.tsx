/**
 * toaster.tsx — canonical mount point for sonner's <Toaster />. App.tsx
 * already renders one directly; this file exists so agents that grep for
 * `Toaster` find a familiar landing spot.
 */
import { useEffect, useState, type ComponentProps } from 'react';
import { Toaster as Sonner } from 'sonner';

/** sonner defaults to theme="light"; follow the `dark` class ThemeToggle writes. */
export function Toaster(props: ComponentProps<typeof Sonner>) {
  const read = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const [theme, setTheme] = useState<'dark' | 'light'>(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return <Sonner theme={theme} {...props} />;
}
