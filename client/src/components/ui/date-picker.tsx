import * as React from 'react';
import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import type { Matcher } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, parseDateInputValue, toDateInputValue } from '@/lib/utils';

/**
 * DatePicker — a form field for ONE calendar day.
 *
 * The value is a `YYYY-MM-DD` date key, never a Date or an ISO instant: a due
 * date or appointment day must not move when the browser's time zone does
 * (`new Date('2026-10-02')` is UTC midnight = Oct 1 in the Americas). Store
 * the key as-is (a `DATE` / string column) and validate it with
 * `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.
 *
 * With react-hook-form:
 *   <Controller control={form.control} name="dueDate" render={({ field, fieldState }) => (
 *     <DatePicker id="dueDate" value={field.value} onChange={field.onChange}
 *       aria-invalid={fieldState.invalid} disabled={{ before: new Date() }} />
 *   )} />
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'Pick a date',
  disabled,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  placeholder?: string;
  /** Days that cannot be picked, e.g. `{ before: new Date() }` or `{ dayOfWeek: [0, 6] }`. */
  disabled?: Matcher | Matcher[];
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseDateInputValue(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            ariaInvalid && 'border-destructive',
            className,
          )}
        >
          <CalendarDays aria-hidden className="h-4 w-4" />
          {selected ? format(selected, 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disabled}
          autoFocus
          onSelect={(day) => {
            onChange(day ? toDateInputValue(day) : null);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
