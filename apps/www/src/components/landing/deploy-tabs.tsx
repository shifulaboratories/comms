'use client';

import { useState } from 'react';
import { Terminal, Check } from '@/components/ui/icons';
import { site } from '@/lib/site';

/**
 * Three ways to run it, each with the real commands from the repo's docs.
 * Switching tabs replays the terminal so it reads like it's actually running.
 */
const TARGETS = [
  {
    id: 'railway',
    label: 'Railway',
    blurb:
      'Four services from one repo — about ten minutes, two variables, both one-click references.',
    lines: [
      { k: 'cmt', t: '# New Project → Deploy from GitHub → your fork' },
      { k: 'cmd', t: 'DATABASE_URL=${{ Postgres.DATABASE_URL }}' },
      { k: 'cmd', t: 'REDIS_URL=${{ Redis.REDIS_URL }}' },
      { k: 'ok', t: 'web    ● healthy   migrations applied' },
      { k: 'ok', t: 'worker ● running   5 queues' },
    ],
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    blurb:
      'Web and worker as Cloudflare Containers behind one Worker. Postgres and Redis from Neon and Upstash.',
    lines: [
      { k: 'cmd', t: 'cd deploy/cloudflare && npm install' },
      { k: 'cmd', t: 'npx wrangler secret put DATABASE_URL' },
      { k: 'cmd', t: 'npx wrangler secret put REDIS_URL' },
      { k: 'cmd', t: 'npx wrangler deploy' },
      { k: 'ok', t: 'Deployed comms → https://comms.you.workers.dev' },
    ],
  },
  {
    id: 'docker',
    label: 'Docker',
    blurb: 'The whole stack on one machine: Postgres, Redis, MinIO, web and worker.',
    lines: [
      { k: 'cmd', t: `git clone ${site.github} && cd comms` },
      { k: 'cmd', t: 'docker compose up --build' },
      { k: 'ok', t: 'migrate exited (0)' },
      { k: 'ok', t: 'web    → http://localhost:3000' },
    ],
  },
] as const;

export function DeployTabs() {
  const [active, setActive] = useState<(typeof TARGETS)[number]['id']>('railway');
  const target = TARGETS.find((t) => t.id === active)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10">
      <div role="tablist" aria-label="Deploy target" className="flex gap-2 lg:flex-col">
        {TARGETS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={`ease-out-expo group relative flex-1 rounded-2xl border p-4 text-left transition-all duration-500 lg:flex-none ${
                on
                  ? 'border-line-strong bg-white/[0.04]'
                  : 'border-transparent hover:bg-white/[0.02]'
              }`}
            >
              <span className="flex items-center justify-between text-[14px] font-medium">
                {t.label}
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-all ${on ? 'bg-accent shadow-[0_0_10px_rgb(var(--accent))]' : 'bg-white/15'}`}
                />
              </span>
              <span
                className={`text-muted-foreground mt-1.5 hidden text-[13px] leading-relaxed transition-opacity lg:block ${on ? 'opacity-100' : 'opacity-60'}`}
              >
                {t.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <div className="panel overflow-hidden rounded-3xl shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]">
        <div className="border-line text-subtle flex items-center gap-2 border-b px-4 py-3 text-[12px]">
          <Terminal className="h-4 w-4" />
          {target.label.toLowerCase()} — deploy
        </div>
        <div
          key={active}
          className="min-h-[200px] space-y-2 p-5 font-mono text-[12.5px] leading-relaxed"
        >
          {target.lines.map((l, i) => (
            <p
              key={i}
              className="animate-rise flex gap-2"
              style={{ ['--delay' as string]: `${i * 260}ms` }}
            >
              {l.k === 'cmd' && <span className="text-accent select-none">❯</span>}
              {l.k === 'ok' && <Check className="text-success mt-1 h-3.5 w-3.5 shrink-0" />}
              <span
                className={
                  l.k === 'cmt'
                    ? 'text-subtle'
                    : l.k === 'ok'
                      ? 'text-success/90'
                      : 'text-foreground/90'
                }
              >
                {l.t}
              </span>
            </p>
          ))}
        </div>
        <p className="border-line text-muted-foreground border-t px-5 py-3 text-[12.5px] lg:hidden">
          {target.blurb}
        </p>
      </div>
    </div>
  );
}
