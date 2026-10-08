'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  Clock,
  Images,
  PanelRightClose,
  PanelRightOpen,
  Send,
  UserRound,
} from 'lucide-react';
import { ThreadGallery, type GalleryData } from '@/components/inbox/thread-gallery';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ScheduleData {
  scheduledSends: { id: string; body: string | null; dueAt: string }[];
  followUpAt: string | null;
  snoozedUntil: string | null;
}

type TabKey = 'details' | 'files' | 'schedule';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'details', label: 'Details', icon: UserRound },
  { key: 'files', label: 'Files', icon: Images },
  { key: 'schedule', label: 'Schedule', icon: CalendarClock },
];

/**
 * The third pane, upgraded from a single fixed panel to a switchable one:
 * Details (who + ticket), Files (everything ever shared), Schedule (what's
 * queued to happen on this thread). The chosen tab sticks across
 * conversations, and on desktop the whole pane collapses to a slim rail —
 * a split view you control rather than a panel you're issued.
 */
export function DetailsPane({
  details,
  gallery,
  schedule,
}: {
  /** The Details tab content (PersonCard + TicketPanel), rendered server-side. */
  details: React.ReactNode;
  gallery: GalleryData;
  schedule: ScheduleData;
}) {
  const [tab, setTab] = useState<TabKey>('details');
  const [collapsed, setCollapsed] = useState(false);

  // Both preferences persist — pane layout is a decision, not a session whim.
  useEffect(() => {
    const t = window.localStorage.getItem('comms:pane-tab') as TabKey | null;
    if (t && TABS.some((x) => x.key === t)) setTab(t);
    setCollapsed(window.localStorage.getItem('comms:pane-collapsed') === '1');
  }, []);

  function pickTab(t: TabKey) {
    setTab(t);
    window.localStorage.setItem('comms:pane-tab', t);
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      window.localStorage.setItem('comms:pane-collapsed', c ? '0' : '1');
      return !c;
    });
  }

  const hasSchedule =
    schedule.scheduledSends.length > 0 || schedule.followUpAt || schedule.snoozedUntil;

  // The rail only exists on lg+ — below that the pane is a slide-over, and a
  // collapsed slide-over would just be an empty sheet.
  const rail = (
    <div className="bg-surface hidden h-full w-10 shrink-0 flex-col items-center gap-1 border-l pt-3 lg:flex">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-1.5 transition-colors"
        aria-label="Expand details"
        title="Expand details"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => {
            pickTab(t.key);
            toggleCollapsed();
          }}
          className="text-muted-foreground/70 hover:bg-accent hover:text-foreground rounded-lg p-1.5 transition-colors"
          aria-label={t.label}
          title={t.label}
        >
          <t.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );

  return (
    <>
      {collapsed && rail}
      <aside
        className={cn(
          'bg-surface flex h-full w-[85vw] max-w-[320px] shrink-0 flex-col border-l lg:w-[288px]',
          collapsed && 'lg:hidden',
        )}
      >
        <div className="flex shrink-0 items-center gap-0.5 border-b px-2 py-1.5">
          <div className="bg-secondary/60 flex flex-1 items-center gap-0.5 rounded-lg p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => pickTab(t.key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors',
                  tab === t.key
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <t.icon className="h-3 w-3" />
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="text-muted-foreground hover:bg-accent hover:text-foreground hidden rounded-lg p-1.5 transition-colors lg:block"
            aria-label="Collapse details"
            title="Collapse details"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'details' && details}
          {tab === 'files' && <ThreadGallery data={gallery} />}
          {tab === 'schedule' && (
            <div className="px-4 py-4">
              {!hasSchedule ? (
                <div className="flex flex-col items-center gap-2 px-2 py-10 text-center">
                  <div className="bg-secondary text-muted-foreground grid h-10 w-10 place-items-center rounded-xl">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-medium">Nothing scheduled here</p>
                  <p className="text-muted-foreground text-[11.5px]">
                    Scheduled sends, follow-up reminders and snoozes on this conversation appear
                    here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {schedule.scheduledSends.map((s) => (
                    <div key={s.id} className="rounded-lg border px-2.5 py-2">
                      <p className="type-micro text-muted-foreground/70 mb-1 flex items-center gap-1.5">
                        <Send className="h-3 w-3" />
                        Sending {relativeTime(s.dueAt)}
                      </p>
                      <p className="line-clamp-3 text-[12.5px]">{s.body}</p>
                    </div>
                  ))}
                  {schedule.followUpAt && (
                    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px]">
                      <Clock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      Reminder if no reply {relativeTime(schedule.followUpAt)}
                    </div>
                  )}
                  {schedule.snoozedUntil && (
                    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px]">
                      <Clock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      Snoozed — wakes {relativeTime(schedule.snoozedUntil)}
                    </div>
                  )}
                </div>
              )}
              <Link
                href="/scheduled"
                className="text-muted-foreground hover:bg-accent hover:text-foreground mt-3 block rounded-lg border px-3 py-2 text-center text-[12px] transition-colors"
              >
                Everything scheduled →
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
