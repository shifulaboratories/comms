'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

/**
 * Initials get a soft tint picked from a hue wheel by the text itself, so the
 * same person is the same colour everywhere and a list of contacts is
 * scannable by colour before it is read. Callers that pass their own bg-*
 * class still win (tailwind-merge keeps the last one).
 */
const TINTS = [212, 258, 152, 28, 338, 190, 45, 280];

function tintFor(children: React.ReactNode): number | null {
  if (typeof children !== 'string' || !children.trim()) return null;
  let h = 0;
  for (const ch of children) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, style, children, ...props }, ref) => {
  const hue = tintFor(children);
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      style={hue === null ? style : ({ '--av-h': hue, ...style } as React.CSSProperties)}
      className={cn(
        'bg-muted flex h-full w-full items-center justify-center rounded-full font-medium',
        hue !== null &&
          'bg-[hsl(var(--av-h)_75%_60%/0.16)] text-[hsl(var(--av-h)_55%_40%)] ring-1 ring-inset ring-[hsl(var(--av-h)_70%_60%/0.18)] dark:text-[hsl(var(--av-h)_85%_76%)]',
        className,
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
