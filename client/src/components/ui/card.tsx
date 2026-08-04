import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Hairline as a RING, not a border, plus one step of elevation.
        //
        // Was `border border-border shadow-sm`. Three problems with that:
        // a border participates in layout (so nesting a card shifts content by
        // 1px), it cannot be animated cleanly, and stacking a border AND a
        // shadow double-draws the edge. Vercel's Geist ships its borders as
        // shadows for exactly these reasons
        // (--ds-shadow-border-base: 0 0 0 1px #00000014).
        //
        // --ring-hairline and --shadow-xs come from tokens.css. --card is now a
        // genuinely different colour from --background (they used to be
        // identical, which is why every card read as a flat bordered rectangle
        // on one flat plane).
        //
        // Radius comes from the ladder, not a single uniform --radius: cards sit
        // at lg while buttons and inputs sit at sm. One radius everywhere is the
        // most recognisable generated-UI tell.
        'rounded-[var(--radius-lg)] bg-card text-card-foreground',
        'shadow-[var(--ring-hairline),var(--shadow-xs)]',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('font-heading text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
