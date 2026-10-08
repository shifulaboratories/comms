import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * Focus = ring + border-colour shift together. Stock shadcn uses a 1px ring
 * only, which is nearly invisible against an existing 1px border.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-input bg-surface shadow-xs ease-smooth flex h-9 w-full rounded-lg border px-3 py-1 text-base transition-all duration-150',
          'file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground/70',
          'hover:border-border-strong',
          'focus-visible:border-brand focus-visible:ring-brand/20 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
