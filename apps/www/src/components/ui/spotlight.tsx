'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Wraps a grid of `.spotlight` cards and feeds each the pointer position as
 * --mx/--my. One listener for the whole grid, written straight to style — no
 * React state, so moving the mouse never re-renders anything.
 */
export function SpotlightGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`spotlight-group ${className ?? ''}`}
      onPointerMove={(e) => {
        const cards = ref.current?.querySelectorAll<HTMLElement>('.spotlight');
        cards?.forEach((card) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${e.clientX - r.left}px`);
          card.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
      }}
    >
      {children}
    </div>
  );
}
