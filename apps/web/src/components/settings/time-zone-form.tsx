'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateTimeZone } from '@/server/actions/profile';

/**
 * Your time zone, for the AI's sense of "today". Defaults to whatever this
 * browser reports, so most people only ever press one button.
 */
export function TimeZoneForm({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ?? '');
  const [browserZone, setBrowserZone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setBrowserZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
  }, []);

  const zones = useMemo(() => {
    try {
      return (
        (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
          'timeZone',
        ) ?? []
      );
    } catch {
      return [];
    }
  }, []);

  function save(tz: string) {
    start(async () => {
      const res = await updateTimeZone(tz);
      if (res.ok) {
        setValue(tz);
        toast.success(tz ? `Time zone set to ${tz}` : 'Using the workspace time zone');
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[12.5px] leading-relaxed">
        The AI uses this to know what &ldquo;today&rdquo; and &ldquo;tonight&rdquo; mean when it
        drafts replies or answers questions about your messages. Unset uses the workspace&apos;s
        business-hours time zone.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Globe className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <select
            value={value}
            onChange={(e) => save(e.target.value)}
            disabled={pending}
            className="border-input bg-surface shadow-xs dark:bg-secondary/60 h-9 w-full appearance-none rounded-lg border pl-8 pr-3 text-[13px]"
            aria-label="Time zone"
          >
            <option value="">Workspace default</option>
            {(zones.length ? zones : value ? [value] : []).map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        {browserZone && browserZone !== value && (
          <Button size="sm" variant="secondary" onClick={() => save(browserZone)} loading={pending}>
            Use {browserZone.replace(/_/g, ' ')}
          </Button>
        )}
      </div>
    </div>
  );
}
