'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (key: string, text: string) => {
      await navigator.clipboard.writeText(text).catch(() => {});
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    },
  };
}

/** A labelled single-line value with a copy button; optionally masked. */
export function CopyField({
  label,
  value,
  secret = false,
  hint,
  masked,
}: {
  label: string;
  value: string;
  secret?: boolean;
  hint?: string;
  /** What to show while hidden; defaults to the first 8 characters and dots. */
  masked?: string;
}) {
  const { copied, copy } = useCopy();
  const [shown, setShown] = useState(!secret);
  const display = shown
    ? value
    : (masked ?? `${value.slice(0, 8)}${'•'.repeat(Math.min(24, Math.max(value.length - 8, 4)))}`);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-[11.5px] font-medium uppercase tracking-wider">
          {label}
        </span>
        {hint && <span className="text-muted-foreground text-[11.5px]">{hint}</span>}
      </div>
      <div className="bg-muted/40 flex items-center gap-1 rounded-lg border py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{display}</code>
        {secret && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground grid h-7 w-7 place-items-center rounded-md"
            aria-label={shown ? 'Hide' : 'Show'}
          >
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => copy(label, value)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground grid h-7 w-7 place-items-center rounded-md"
          aria-label={`Copy ${label}`}
        >
          {copied === label ? (
            <Check className="text-success h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/** A multi-line snippet with a copy button. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-[hsl(240_6%_7%)] text-zinc-100 dark:bg-black/40">
      {label && (
        <div className="border-b border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-400">
          {label}
        </div>
      )}
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => copy('code', code)}
        className={cn(
          'absolute right-1.5 grid h-7 w-7 place-items-center rounded-md bg-white/5 text-zinc-300 opacity-70 transition hover:bg-white/15 hover:opacity-100',
          label ? 'top-1' : 'top-1.5',
        )}
        aria-label="Copy"
      >
        {copied === 'code' ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="text-muted-foreground [&>li:before]:bg-muted [&>li:before]:text-foreground space-y-2 text-[13px] leading-relaxed [counter-reset:step] [&>li:before]:absolute [&>li:before]:left-0 [&>li:before]:top-px [&>li:before]:grid [&>li:before]:h-5 [&>li:before]:w-5 [&>li:before]:place-items-center [&>li:before]:rounded-full [&>li:before]:text-[11px] [&>li:before]:font-semibold [&>li:before]:content-[counter(step)] [&>li:before]:[counter-increment:step] [&>li]:relative [&>li]:pl-7">
      {children}
    </ol>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground font-medium">{children}</span>;
}
