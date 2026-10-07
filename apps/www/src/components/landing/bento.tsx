'use client';

import { useEffect, useState } from 'react';
import { useInView, useLoop, useReducedMotion, useTypewriter } from '@/lib/motion';
import { SpotlightGroup } from '@/components/ui/spotlight';
import { Avatar, Bubble, Kbd, Tag } from './chat';
import { Lock, Sparkle, Clock, Moon, Bolt } from '@/components/ui/icons';

/**
 * Feature bento. Each card is a small working piece of the product rather than
 * a picture of it, and each only animates while it's on screen.
 */
export function Bento() {
  return (
    <SpotlightGroup className="grid auto-rows-[minmax(0,auto)] gap-3 md:grid-cols-6">
      <Card
        className="md:col-span-4"
        title="Two agents, one number, zero collisions"
        body="Sends are serialized per conversation and live presence shows who’s replying — so nobody answers twice."
      >
        <CollisionDemo />
      </Card>
      <Card
        className="md:col-span-2"
        title="Macros in one keystroke"
        body="Type / and the right answer is a keypress away."
      >
        <MacroDemo />
      </Card>
      <Card
        className="md:col-span-2"
        title="AI that reads the thread"
        body="Summaries, suggested replies and triage. Bring your own key — or leave it off."
      >
        <SummaryDemo />
      </Card>
      <Card
        className="md:col-span-2"
        title="SLAs you can see"
        body="First-reply timers on every ticket, with a nudge before they slip."
      >
        <SlaDemo />
      </Card>
      <Card
        className="md:col-span-2"
        title="Snooze until it matters"
        body="Park a thread until Monday. It comes back on its own."
      >
        <SnoozeDemo />
      </Card>
      <Card
        className="md:col-span-6"
        title="Automations that do the boring half"
        body="Route by keyword, tag by intent, auto-reply after hours. Rules run on every inbound message, in order."
      >
        <AutomationDemo />
      </Card>
    </SpotlightGroup>
  );
}

function Card({
  className,
  title,
  body,
  children,
}: {
  className: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-reveal
      className={`spotlight panel group flex flex-col overflow-hidden rounded-3xl ${className}`}
    >
      <div className="relative min-h-[220px] flex-1 overflow-hidden">{children}</div>
      <div className="border-line relative border-t p-5">
        <h3 className="text-[15px] tracking-tight">{title}</h3>
        <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/* ── 1. Collision-free sending ──────────────────────────────────────────── */
function CollisionDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const step = useLoop(4, 1900, inView && !reduced);
  return (
    <div ref={ref} className="dots grid h-full grid-cols-2 gap-3 p-5">
      {[
        { name: 'Maya Patel', tone: 3, me: true },
        { name: 'Sam Rivera', tone: 2, me: false },
      ].map((a) => {
        const typing = a.me && step >= 1;
        const sent = a.me && step >= 3;
        const locked = !a.me && step >= 1 && step < 3;
        return (
          <div
            key={a.name}
            className="border-line flex flex-col rounded-2xl border bg-[rgb(var(--surface-sunken))]/80 p-3"
          >
            <div className="flex items-center gap-2 text-[11.5px]">
              <Avatar name={a.name} size={20} tone={a.tone} />
              <span className="font-medium">{a.name.split(' ')[0]}’s screen</span>
            </div>
            <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
              <Bubble side="in">Can I change my size to M?</Bubble>
              {sent && (
                <div className="animate-pop">
                  <Bubble side="out" meta="Maya · Delivered">
                    Done — swapped to M! 👕
                  </Bubble>
                </div>
              )}
            </div>
            <div
              className={`mt-3 flex h-9 items-center gap-2 rounded-xl border px-3 text-[11.5px] transition-all duration-500 ${
                locked
                  ? 'border-warning/30 bg-warning/[0.06] text-warning'
                  : typing && !sent
                    ? 'border-accent/40 text-foreground'
                    : 'border-line text-subtle'
              }`}
            >
              {locked ? (
                <>
                  <Lock className="h-3.5 w-3.5" /> Maya is replying…
                </>
              ) : typing && !sent ? (
                <>
                  Done — swapped to M!
                  <span className="animate-caret bg-accent h-3.5 w-px" />
                </>
              ) : (
                'Reply…'
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 2. Macros ──────────────────────────────────────────────────────────── */
const MACROS = [
  { key: '/shipping-eta', text: 'Your order ships within 24h — tracking follows by text.' },
  { key: '/refund', text: 'Refund started! Expect it in 3–5 business days.' },
  { key: '/hours', text: 'We’re open 9–6 weekdays, 10–4 weekends.' },
];
function MacroDemo() {
  const [sel, setSel] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const text = useTypewriter(picked === null ? '' : MACROS[picked]!.text, picked !== null, 70);
  return (
    <div className="flex h-full flex-col gap-2 p-4" onMouseLeave={() => setPicked(null)}>
      <div className="border-line rounded-xl border bg-black/30 px-3 py-2.5 text-[12px]">
        {picked === null ? (
          <span className="text-muted-foreground">
            /
            <span className="animate-caret bg-accent ml-px inline-block h-3 w-px translate-y-0.5" />
          </span>
        ) : (
          <span>{text}</span>
        )}
      </div>
      <ul
        className="border-line overflow-hidden rounded-xl border bg-[rgb(var(--surface-sunken))]/80 p-1"
        role="listbox"
        aria-label="Macros"
      >
        {MACROS.map((m, i) => (
          <li key={m.key}>
            <button
              role="option"
              aria-selected={sel === i}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => setPicked(i)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors ${
                sel === i ? 'text-foreground bg-white/[0.07]' : 'text-muted-foreground'
              }`}
            >
              <span className="font-mono text-[11.5px]">{m.key}</span>
              {sel === i && <Kbd>↵</Kbd>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 3. AI summary ──────────────────────────────────────────────────────── */
const SUMMARY =
  'Customer asked twice about a late delivery and is frustrated. Order #4821 was delayed by weather; it arrives Thursday. Suggest an apology and a 10% code.';
function SummaryDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [run, setRun] = useState(0);
  const [thinking, setThinking] = useState(true);
  useEffect(() => {
    if (!inView) return;
    setThinking(true);
    const t = window.setTimeout(() => setThinking(false), reduced ? 0 : 1100);
    return () => window.clearTimeout(t);
  }, [inView, run, reduced]);
  const text = useTypewriter(SUMMARY, inView && !thinking && !reduced, 60);
  return (
    <div ref={ref} className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#b3a8ff]">
          <Sparkle className="h-3 w-3" /> Summary
        </span>
        <button
          onClick={() => setRun((r) => r + 1)}
          className="text-subtle hover:text-foreground rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-white/5"
        >
          Regenerate
        </button>
      </div>
      {thinking ? (
        <div className="mt-3 space-y-2">
          <div className="shimmer h-2.5 w-full rounded-full" />
          <div className="shimmer h-2.5 w-[86%] rounded-full" />
          <div className="shimmer h-2.5 w-[64%] rounded-full" />
        </div>
      ) : (
        <p className="text-foreground/90 mt-3 text-[12.5px] leading-relaxed">{text}</p>
      )}
      <div className="mt-auto flex gap-1 pt-3">
        <Tag tone="violet">Delivery</Tag>
        <Tag>Frustrated</Tag>
      </div>
    </div>
  );
}

/* ── 4. SLA ring ────────────────────────────────────────────────────────── */
function SlaDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [left, setLeft] = useState(300);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = window.setInterval(() => setLeft((s) => (s <= 0 ? 300 : s - 3)), 60);
    return () => window.clearInterval(id);
  }, [inView, reduced]);
  const pct = left / 300;
  const color =
    pct > 0.5 ? 'rgb(var(--success))' : pct > 0.2 ? 'rgb(var(--warning))' : 'rgb(var(--danger))';
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div ref={ref} className="grid h-full place-items-center p-4">
      <div className="relative grid h-36 w-36 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="rgb(255 255 255 / 0.06)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 44}
            strokeDashoffset={2 * Math.PI * 44 * (1 - pct)}
            style={{ transition: 'stroke 0.6s', filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="text-center">
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {mm}:{ss}
          </p>
          <p className="text-subtle mt-0.5 flex items-center justify-center gap-1 text-[10.5px]">
            <Clock className="h-3 w-3" /> first reply
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── 5. Snooze ──────────────────────────────────────────────────────────── */
function SnoozeDemo() {
  const [snoozed, setSnoozed] = useState<string | null>(null);
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div
        className={`border-line ease-out-expo flex items-center gap-2.5 rounded-xl border bg-[rgb(var(--surface-sunken))]/80 p-2.5 transition-all duration-700 ${
          snoozed ? 'translate-y-1 scale-[0.97] opacity-50 blur-[0.5px]' : ''
        }`}
      >
        <Avatar name="Ana Ruiz" size={26} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium">Ana Ruiz</p>
          <p className="text-muted-foreground truncate text-[11px]">Restock on the blue tote?</p>
        </div>
        {snoozed && (
          <span className="animate-pop bg-violet/15 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] text-[#b3a8ff]">
            <Moon className="h-3 w-3" /> {snoozed}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {['Tomorrow 9am', 'Monday', 'Next week', 'Custom…'].map((o) => (
          <button
            key={o}
            onClick={() => setSnoozed((s) => (s === o ? null : o))}
            className={`rounded-lg border px-2 py-2 text-[11.5px] transition-all duration-300 ${
              snoozed === o
                ? 'border-violet/50 bg-violet/10 text-foreground'
                : 'border-line text-muted-foreground hover:border-line-strong hover:text-foreground'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── 6. Automation graph ────────────────────────────────────────────────── */
function AutomationDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [enabled, setEnabled] = useState(true);
  const step = useLoop(4, 1100, inView && enabled && !reduced);
  const nodes = [
    {
      x: 4,
      title: 'Message arrives',
      sub: 'Any iMessage inbox',
      icon: <Bolt className="h-3.5 w-3.5" />,
    },
    {
      x: 29,
      title: 'If it mentions',
      sub: '“refund”, “charge”',
      icon: <span className="text-[11px] font-semibold">if</span>,
    },
    {
      x: 54,
      title: 'Tag + assign',
      sub: 'Billing → Sam',
      icon: <span className="text-[11px] font-semibold">#</span>,
    },
    {
      x: 79,
      title: 'Suggest macro',
      sub: '/refund-policy',
      icon: <Sparkle className="h-3.5 w-3.5" />,
    },
  ];
  return (
    <div ref={ref} className="dots relative h-full min-h-[220px] overflow-x-auto px-5 py-6">
      <div className="relative h-[170px] min-w-[720px]">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          {nodes.slice(0, -1).map((n, i) => (
            <line
              key={i}
              x1={`${n.x + 17}%`}
              x2={`${nodes[i + 1]!.x}%`}
              y1="50%"
              y2="50%"
              stroke={enabled && step > i ? 'rgb(var(--accent))' : 'rgb(255 255 255 / 0.18)'}
              strokeWidth="1.5"
              strokeDasharray="4 8"
              className={enabled ? 'animate-dash' : ''}
              style={{ transition: 'stroke 0.4s' }}
            />
          ))}
        </svg>
        {nodes.map((n, i) => {
          const lit = enabled && step >= i;
          return (
            <div
              key={n.title}
              className={`ease-out-expo absolute top-1/2 w-[17%] -translate-y-1/2 rounded-2xl border p-3 transition-all duration-500 ${
                lit
                  ? 'border-accent/40 bg-[rgb(var(--surface-raised))] shadow-[0_0_0_4px_rgb(var(--accent)/0.08),0_16px_40px_-16px_rgb(var(--accent)/0.6)]'
                  : 'border-line bg-[rgb(var(--surface-sunken))]'
              }`}
              style={{ left: `${n.x}%` }}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-lg transition-colors duration-500 ${
                  lit ? 'bg-accent text-white' : 'text-subtle bg-white/[0.06]'
                }`}
              >
                {n.icon}
              </span>
              <p className="mt-2 text-[12px] font-medium">{n.title}</p>
              <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{n.sub}</p>
            </div>
          );
        })}
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled((v) => !v)}
        className="border-line text-muted-foreground absolute right-4 top-4 flex items-center gap-2 rounded-full border bg-black/40 py-1 pl-3 pr-1 text-[11px] backdrop-blur"
      >
        {enabled ? 'Rule on' : 'Rule off'}
        <span
          className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ${enabled ? 'bg-accent' : 'bg-white/15'}`}
        >
          <span
            className={`ease-spring absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
          />
        </span>
      </button>
    </div>
  );
}
