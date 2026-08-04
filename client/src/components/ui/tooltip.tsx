import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
            'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground',
      // Tooltips are the LOWEST floating layer, so they take the smallest step
      // on the ladder — below menus (4px blur) and modals (16px). This is also
      // the only consumer of --elevation-raised, which shipped in tokens.css
      // with nothing referencing it. Without any elevation a tooltip over a
      // card has no edge at all in dark mode, where a solid fill alone does not
      // separate it from what is behind it.
      'shadow-[shadow:var(--elevation-raised)]',
      // Motion from the tokens rather than Tailwind's defaults: fast, because a
      // tooltip that eases in slowly feels broken on hover.
      'duration-fast ease-out',
      'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
