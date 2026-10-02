import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Calendar — shadcn's react-day-picker v9 calendar, written for Tailwind 3.4.
 * Keyboard (arrows, PageUp/Down, Home/End) and ARIA grid semantics come from
 * react-day-picker. Pass any DayPicker prop: `mode="single" | "range"`,
 * `disabled={{ before: new Date() }}`, `captionLayout="dropdown"` for
 * birthdays, `numberOfMonths={2}` for stays.
 *
 * For a form field use <DatePicker /> (./date-picker.tsx), which wraps this in
 * a Popover and speaks YYYY-MM-DD date keys.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'flex h-9 items-center justify-center px-9',
        caption_label: 'select-none text-sm font-medium',
        dropdowns: 'flex items-center justify-center gap-1.5 text-sm font-medium',
        dropdown_root:
          'relative rounded-md border border-input shadow-xs focus-within:ring-2 focus-within:ring-ring',
        dropdown: 'absolute inset-0 cursor-pointer opacity-0',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-9 w-9 p-0'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-9 w-9 p-0'),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 select-none text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative h-9 w-9 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside: 'text-muted-foreground opacity-60 aria-selected:opacity-100',
        disabled: 'text-muted-foreground opacity-50',
        range_start: 'rounded-l-md bg-accent',
        range_middle: 'bg-accent [&>button]:!bg-transparent [&>button]:!text-accent-foreground',
        range_end: 'rounded-r-md bg-accent',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: cls }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', cls)} aria-hidden />
          ) : (
            <ChevronRight className={cn('h-4 w-4', cls)} aria-hidden />
          ),
      }}
      {...props}
    />
  );
}
