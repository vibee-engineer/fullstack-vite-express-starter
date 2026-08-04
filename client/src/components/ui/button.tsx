import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Radius from the ladder (sm = 4px for controls), motion from the token set,
  // and a press affordance. Notes on each:
  //
  // - transition targets are named explicitly instead of `transition-colors`,
  //   because the shadow now carries the hairline and the focus ring and both
  //   need to animate. Never `transition-all`: it animates layout properties
  //   and drops frames.
  // - `active:translate-y-[0.5px]` is the cheapest press affordance that reads
  //   as physical. Half a pixel, so it never shifts surrounding layout.
  // - focus ring is offset and only on :focus-visible, so keyboard users get it
  //   and mouse users do not.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-medium ring-offset-background'
    + ' transition-[background-color,box-shadow,transform,color] duration-[var(--dur-fast)] ease-[var(--ease-out)]'
    + ' active:translate-y-[0.5px]'
    + ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
    + ' disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // The inset top highlight is lifted verbatim from Linear. It is the
        // highest "someone designed this" signal per line of CSS: a 1px inner
        // light edge reads as a physical raised surface rather than a filled
        // rectangle. --shadow-button ships it from tokens.css.
        default:
          'bg-primary text-primary-foreground shadow-[var(--shadow-button)] hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        // Ring rather than border, same reasoning as Card: no layout
        // participation, and it composes with the focus ring in one property.
        outline:
          'bg-background shadow-[var(--ring-hairline)] hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 rounded-[var(--radius-md)] px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
