'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The visual language for anything the model is doing. One loader, one trace,
 * one shimmer — so every AI wait in the product reads the same way, and reads
 * as work in progress rather than a frozen spinner.
 */

/** Seconds since `active` became true, to one decimal. Resets when it ends. */
export function useElapsed(active: boolean): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) {
      setMs(0);
      return;
    }
    const t0 = performance.now();
    const id = window.setInterval(() => setMs(performance.now() - t0), 100);
    return () => window.clearInterval(id);
  }, [active]);
  return Math.floor(ms / 100) / 10;
}

/**
 * A 3×3 grid of cells lighting in sequence: the pixel-grid loader. Pure CSS
 * keyframes on staggered delays — no JS per frame.
 */
export function PixelLoader({ className }: { className?: string }) {
  // Snake order, so the lit cell travels instead of blinking at random.
  const order = [0, 1, 2, 5, 4, 3, 6, 7, 8];
  return (
    <span className={cn('inline-grid grid-cols-3 gap-[1.5px]', className)} aria-hidden>
      {order.map((o, i) => (
        <span
          key={i}
          className="animate-pixel h-[3px] w-[3px] rounded-[1px] bg-current"
          style={{ animationDelay: `${order.indexOf(i) * 110}ms` }}
        />
      ))}
    </span>
  );
}

/** "Drafting 2.3s" — loader, shimmering verb, elapsed time. */
export function WorkingLabel({
  label,
  active = true,
  className,
}: {
  label: string;
  active?: boolean;
  className?: string;
}) {
  const s = useElapsed(active);
  return (
    <span className={cn('inline-flex items-center gap-2 text-[12.5px]', className)} role="status">
      <PixelLoader className="text-foreground/80" />
      <span className="text-shimmer font-medium">{label}</span>
      <span className="tabular text-muted-foreground/70 font-mono text-[11px]">
        {s.toFixed(1)}s
      </span>
    </span>
  );
}

export type TraceStep = { label: string; state: 'done' | 'active' | 'todo' };

/**
 * An expandable "Thinking" trace: the steps the model is taking, with the
 * current one spinning and finished ones checked. Collapses to its header once
 * the work is done so the answer, not the process, is what you read.
 */
export function ThinkingTrace({
  steps,
  title = 'Thinking',
  done = false,
}: {
  steps: TraceStep[];
  title?: string;
  done?: boolean;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (done) setOpen(false);
  }, [done]);
  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
        aria-expanded={open}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className={cn('font-medium', !done && 'text-shimmer')}>
          {done ? 'Thought it through' : title}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <div
        className={cn(
          'ease-smooth grid transition-[grid-template-rows,opacity] duration-300',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <ol className="border-border-strong ml-[7px] mt-2 space-y-2.5 overflow-hidden border-l pl-4">
          {steps.map((s) => (
            <li
              key={s.label}
              className={cn(
                'flex items-center gap-2.5 transition-opacity duration-300',
                s.state === 'todo' && 'opacity-40',
              )}
            >
              {s.state === 'done' ? (
                <Check className="text-muted-foreground h-3.5 w-3.5" />
              ) : s.state === 'active' ? (
                <span className="border-muted-foreground/30 border-t-foreground h-3.5 w-3.5 animate-spin rounded-full border-[1.5px]" />
              ) : (
                <span className="border-muted-foreground/30 h-3.5 w-3.5 rounded-full border-[1.5px]" />
              )}
              <span
                className={cn(s.state === 'done' ? 'text-muted-foreground' : 'text-foreground')}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Advance through `labels` on a timer while `active`, for operations that are
 * one server call but several real steps. Each step holds for `ms`; the last
 * one stays active until the work finishes.
 */
export function useSteppedTrace(labels: string[], active: boolean, ms = 1400): TraceStep[] {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    setI(0);
    const id = window.setInterval(() => setI((v) => Math.min(v + 1, labels.length - 1)), ms);
    return () => window.clearInterval(id);
  }, [active, labels.length, ms]);
  return labels.map((label, n) => ({
    label,
    state: !active ? 'done' : n < i ? 'done' : n === i ? 'active' : 'todo',
  }));
}
