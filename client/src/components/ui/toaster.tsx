/**
 * toaster.tsx — sonner's <Toaster /> wired to the brand tokens.
 *
 * This was a bare `export { Toaster } from 'sonner'`, which means sonner styled
 * itself: its own greys, its own radius, its own shadow. So every toast in every
 * generated app looked identical regardless of brand, and in dark mode carried
 * sonner's light-theme surface unless its own theme prop was set — the one
 * surface in the app that ignored the design system entirely.
 *
 * Toasts are a floating layer, so they take --elevation-menu (the same step as
 * dropdowns and popovers): above the page, below a modal.
 */
import { Toaster as SonnerToaster } from 'sonner';

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      // `theme="system"` would follow the OS, not the app's own toggle. The
      // .dark class is what this app switches on, so the surface tokens below
      // already resolve per-theme and sonner must not second-guess them.
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast bg-popover text-popover-foreground border-border '
            + 'shadow-[shadow:var(--elevation-menu)] rounded-lg',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground rounded-md',
          cancelButton: 'bg-muted text-muted-foreground rounded-md',
          error: 'bg-destructive text-destructive-foreground border-destructive',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
