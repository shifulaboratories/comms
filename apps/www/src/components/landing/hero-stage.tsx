'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion, useTypewriter } from '@/lib/motion';
import { Avatar, Bubble, StatusPill, Tag, TypingBubble, Kbd, type Status } from './chat';
import { Sparkle, Send, Clock, Check } from '@/components/ui/icons';

/**
 * The hero: a working miniature of the inbox on a 3D stage.
 *
 * It plays a scripted story on its own — a text arrives, AI summarizes it, it
 * gets assigned, Maya replies, the customer reacts — and the moment you click
 * anything it hands control to you: switch threads, change status, type and
 * send. The rig tilts back as you scroll and follows the pointer, and the
 * floating cards sit at real Z depth so they parallax against the window.
 */

type Msg = {
  id: number;
  side: 'in' | 'out' | 'note';
  text: string;
  meta?: string;
  reaction?: string;
};
type Convo = {
  id: string;
  name: string;
  handle: string;
  preview: string;
  time: string;
  unread: boolean;
  status: Status;
  tags: string[];
  assignee?: string;
  messages: Msg[];
};

const REPLY = 'It ships today! Tracking link coming within the hour 📦';

function initialConvos(): Convo[] {
  return [
    {
      id: 'jordan',
      name: 'Jordan Lee',
      handle: '+1 (415) 555-0142',
      preview: 'Is order #4821 shipping today?',
      time: 'now',
      unread: true,
      status: 'open',
      tags: ['Order'],
      messages: [
        {
          id: -2,
          side: 'out',
          text: 'Thanks for your order, Jordan! 🎉 We’ll text you when it ships.',
          meta: 'Auto-reply · Yesterday',
        },
        { id: 1, side: 'in', text: 'Hey! Quick one — is order #4821 shipping today?' },
        { id: 2, side: 'in', text: 'Need it before the weekend 🙏', meta: '9:41 AM' },
      ],
    },
    {
      id: 'priya',
      name: 'Priya · Bloom Florist',
      handle: 'priya@bloom.co',
      preview: 'Can we move Saturday to 10am?',
      time: '2m',
      unread: true,
      status: 'open',
      tags: ['Delivery'],
      messages: [
        { id: 1, side: 'in', text: 'Morning! Can we move Saturday’s delivery to 10am instead?' },
        { id: 2, side: 'note', text: 'Sam: 10am slot is free — confirming with the driver.' },
      ],
    },
    {
      id: 'marcus',
      name: 'Marcus Chen',
      handle: '+1 (628) 555-0199',
      preview: 'Thanks so much, that worked 🙌',
      time: '14m',
      unread: false,
      status: 'closed',
      tags: ['Billing'],
      assignee: 'Sam Rivera',
      messages: [
        { id: 1, side: 'in', text: 'I got charged twice this month?' },
        {
          id: 2,
          side: 'out',
          text: 'So sorry! Refunded the duplicate — 3–5 days to land.',
          meta: 'Sam · Read 9:12 AM',
        },
        { id: 3, side: 'in', text: 'Thanks so much, that worked 🙌', reaction: '👍' },
      ],
    },
    {
      id: 'ana',
      name: 'Ana Ruiz',
      handle: '+1 (312) 555-0107',
      preview: 'Do you have this in blue?',
      time: '1h',
      unread: false,
      status: 'snoozed',
      tags: ['Sales'],
      messages: [{ id: 1, side: 'in', text: 'Do you have the tote in blue? 💙' }],
    },
  ];
}

/** The scripted beats, in order. Each lasts STEP_MS. */
const BEATS = ['arrive', 'summary', 'assign', 'typing', 'sent', 'react', 'rest'] as const;
type Beat = (typeof BEATS)[number];
const STEP_MS = 2300;

export function HeroStage() {
  const reduced = useReducedMotion();
  const [viewRef, inView] = useInView<HTMLDivElement>('100px');
  const rigRef = useRef<HTMLDivElement>(null);

  const [convos, setConvos] = useState(initialConvos);
  const [activeId, setActiveId] = useState('jordan');
  const [beat, setBeat] = useState<Beat>('arrive');
  const [interactive, setInteractive] = useState(false);
  const [draft, setDraft] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);

  const active = convos.find((c) => c.id === activeId)!;
  const autoplay = !interactive && !reduced && inView;
  const typed = useTypewriter(REPLY, beat === 'typing' && autoplay, 34);

  // ── Scripted story ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setTimeout(
      () => {
        const next = BEATS[(BEATS.indexOf(beat) + 1) % BEATS.length]!;
        if (next === 'arrive') {
          setConvos(initialConvos());
          setActiveId('jordan');
        }
        if (next === 'assign') {
          patch('jordan', { assignee: 'Maya Patel', unread: false });
        }
        if (next === 'sent') {
          patch('jordan', (c) => ({
            status: 'pending',
            preview: REPLY,
            messages: [
              ...c.messages,
              { id: 3, side: 'out', text: REPLY, meta: 'Maya · Delivered' },
            ],
          }));
        }
        if (next === 'react') {
          patch('jordan', (c) => ({
            messages: c.messages.map((m) =>
              m.id === 3 ? { ...m, reaction: '❤️', meta: 'Maya · Read 9:43 AM' } : m,
            ),
          }));
        }
        setBeat(next);
      },
      beat === 'typing' ? STEP_MS + 900 : STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [beat, autoplay]); // eslint-disable-line react-hooks/exhaustive-deps

  function patch(id: string, p: Partial<Convo> | ((c: Convo) => Partial<Convo>)) {
    setConvos((cs) =>
      cs.map((c) => (c.id === id ? { ...c, ...(typeof p === 'function' ? p(c) : p) } : c)),
    );
  }

  function takeOver() {
    if (!interactive) setInteractive(true);
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    takeOver();
    setDraft('');
    const id = Date.now();
    patch(activeId, (c) => ({
      preview: text,
      status: c.status === 'closed' ? 'open' : 'pending',
      unread: false,
      messages: [...c.messages, { id, side: 'out', text, meta: 'You · Delivered' }],
    }));
    // The customer types back, so the thread feels alive in your hands too.
    window.setTimeout(() => setPeerTyping(true), 700);
    window.setTimeout(() => {
      setPeerTyping(false);
      patch(activeId, (c) => ({
        messages: [
          ...c.messages.map((m) => (m.id === id ? { ...m, meta: 'You · Read just now' } : m)),
          { id: id + 1, side: 'in', text: pickReply(text) },
        ],
      }));
    }, 2300);
  }

  // ── 3D rig: scroll tilt + pointer parallax, eased in one rAF loop ─────────
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig || reduced) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0, s: 0 };
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth - 0.5;
      target.y = e.clientY / window.innerHeight - 0.5;
    };
    const tick = () => {
      const s = Math.min(1, window.scrollY / 520);
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      cur.s += (s - cur.s) * 0.12;
      const rx = 20 * (1 - cur.s) + 2 - cur.y * 5;
      const ry = cur.x * 7;
      const scale = 0.92 + cur.s * 0.08;
      rig.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
      raf = requestAnimationFrame(tick);
    };
    if (inView) raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [inView, reduced]);

  const showSummary = !interactive && beat !== 'arrive' && activeId === 'jordan';
  const showAssigned = !interactive && ['assign', 'typing'].includes(beat);
  const replied =
    active.messages.some((m) => m.side === 'out' && m.id === 3) && activeId === 'jordan';

  return (
    <div ref={viewRef} className="relative mx-auto w-full max-w-[1120px] [perspective:2200px]">
      {/* Glow pooled under the stage */}
      <div
        aria-hidden
        className="bg-accent/25 pointer-events-none absolute inset-x-[8%] top-[18%] h-[70%] rounded-[50%] blur-[100px]"
      />

      <div
        ref={rigRef}
        className="relative will-change-transform [transform-style:preserve-3d]"
        style={{
          transform: reduced ? 'none' : 'rotateX(22deg) scale(0.92)',
          transformOrigin: '50% 0%',
        }}
      >
        {/* ── App window ─────────────────────────────────────────────── */}
        {/* translateZ(0) gives the window its own flat layer. Without it,
            Chrome hit-tests positioned children inside the preserve-3d rig
            against the wrong element and clicks on inbox rows fall through. */}
        <div
          className="panel relative overflow-hidden rounded-[22px] shadow-[0_50px_120px_-30px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.04)] [transform:translateZ(0)]"
          onPointerDown={takeOver}
        >
          {/* Title bar */}
          <div className="border-line flex h-10 items-center gap-2 border-b bg-white/[0.015] px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <div className="text-subtle mx-auto hidden items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1 text-[11px] sm:flex">
              <span className="bg-success h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgb(var(--success))]" />
              Support · +1 (888) 555-0100
            </div>
            <div className="ml-auto flex -space-x-1.5 sm:ml-0">
              <Avatar name="Maya Patel" size={20} tone={3} ring />
              <Avatar name="Sam Rivera" size={20} tone={2} ring />
              <Avatar name="Leo Park" size={20} tone={4} ring />
            </div>
          </div>

          <div className="grid h-[380px] grid-cols-[minmax(0,1fr)] sm:h-[460px] sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_230px]">
            {/* Conversation list */}
            <aside className="border-line hidden flex-col border-r sm:flex">
              <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
                <p className="text-[13px] font-semibold">Inbox</p>
                <span className="text-subtle flex items-center gap-1 text-[11px]">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </div>
              <div className="flex gap-1 px-3 pb-2 text-[11px]">
                {['Mine', 'Unassigned', 'All'].map((f, i) => (
                  <span
                    key={f}
                    className={`rounded-md px-2 py-1 ${i === 2 ? 'text-foreground bg-white/[0.07]' : 'text-subtle'}`}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <ul className="flex-1 space-y-0.5 overflow-hidden px-2">
                {convos.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        takeOver();
                        setActiveId(c.id);
                        patch(c.id, { unread: false });
                      }}
                      className={`group relative w-full rounded-xl px-2.5 py-2.5 text-left transition-colors duration-300 ${
                        c.id === activeId ? 'bg-white/[0.07]' : 'hover:bg-white/[0.035]'
                      }`}
                    >
                      {c.id === activeId && (
                        <span className="bg-accent absolute inset-y-3 left-0 w-[2px] rounded-full" />
                      )}
                      <div className="flex items-start gap-2.5">
                        <div className="relative">
                          <Avatar name={c.name} size={30} />
                          {c.unread && (
                            <span className="bg-accent absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[rgb(var(--surface-raised))]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p
                              className={`truncate text-[12.5px] ${c.unread ? 'font-semibold' : 'text-foreground/85 font-medium'}`}
                            >
                              {c.name}
                            </p>
                            <span className="text-subtle shrink-0 text-[10.5px]">{c.time}</span>
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-[11.5px]">
                            {c.preview}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1">
                            {c.tags.map((t) => (
                              <Tag key={t}>{t}</Tag>
                            ))}
                            {c.assignee && (
                              <span className="animate-pop ml-auto">
                                <Avatar
                                  name={c.assignee}
                                  size={16}
                                  tone={c.assignee.startsWith('Maya') ? 3 : 2}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Thread */}
            <section className="flex min-w-0 flex-col">
              <div className="border-line flex items-center gap-3 border-b px-4 py-2.5">
                <Avatar name={active.name} size={28} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{active.name}</p>
                  <p className="text-subtle truncate text-[11px]">iMessage · {active.handle}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <StatusPill
                    status={active.status}
                    onClick={() => {
                      takeOver();
                      const order: Status[] = ['open', 'pending', 'snoozed', 'closed'];
                      patch(activeId, {
                        status: order[(order.indexOf(active.status) + 1) % order.length],
                      });
                    }}
                  />
                </div>
              </div>

              <div className="no-scrollbar flex flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 py-4">
                {active.messages.map((m) => (
                  <div key={`${activeId}-${m.id}`} className="animate-pop">
                    <Bubble side={m.side} meta={m.meta} reaction={m.reaction}>
                      {m.text}
                    </Bubble>
                  </div>
                ))}
                {peerTyping && <TypingBubble />}
              </div>

              {/* Composer */}
              <div className="border-line border-t p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="border-line focus-within:border-accent/50 flex items-center gap-2 rounded-2xl border bg-black/30 py-1.5 pl-3.5 pr-1.5 transition-colors"
                >
                  {beat === 'typing' && autoplay && activeId === 'jordan' ? (
                    <p className="min-w-0 flex-1 truncate text-[13px]">
                      {typed}
                      <span className="animate-caret bg-accent ml-px inline-block h-3.5 w-px translate-y-0.5" />
                    </p>
                  ) : (
                    <input
                      value={draft}
                      onChange={(e) => {
                        takeOver();
                        setDraft(e.target.value);
                      }}
                      onFocus={takeOver}
                      placeholder={
                        interactive ? 'Type a reply and press Enter…' : 'Click anywhere to try it'
                      }
                      aria-label="Reply"
                      className="placeholder:text-subtle min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                    />
                  )}
                  <button
                    type="submit"
                    aria-label="Send"
                    className={`grid h-8 w-8 place-items-center rounded-full transition-all duration-300 ${
                      draft.trim() || (beat === 'typing' && autoplay)
                        ? 'bg-accent scale-100 text-white'
                        : 'text-subtle scale-90 bg-white/10'
                    }`}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </section>

            {/* Details */}
            <aside className="border-line hidden flex-col gap-4 border-l p-4 text-[12px] lg:flex">
              <div>
                <p className="text-subtle mb-2 text-[10.5px] font-medium uppercase tracking-wider">
                  Assignee
                </p>
                {active.assignee ? (
                  <div key={active.assignee} className="animate-pop flex items-center gap-2">
                    <Avatar
                      name={active.assignee}
                      size={22}
                      tone={active.assignee.startsWith('Maya') ? 3 : 2}
                    />
                    <span className="font-medium">{active.assignee}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      takeOver();
                      patch(activeId, { assignee: 'Maya Patel' });
                    }}
                    className="border-line-strong text-muted-foreground hover:border-accent/50 hover:text-foreground rounded-lg border border-dashed px-2.5 py-1.5 transition-colors"
                  >
                    + Assign to me
                  </button>
                )}
              </div>
              <div>
                <p className="text-subtle mb-2 text-[10.5px] font-medium uppercase tracking-wider">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {active.tags.map((t) => (
                    <Tag key={t} tone="accent">
                      {t}
                    </Tag>
                  ))}
                  <Tag>VIP</Tag>
                </div>
              </div>
              <div>
                <p className="text-subtle mb-2 text-[10.5px] font-medium uppercase tracking-wider">
                  SLA
                </p>
                <div className="flex items-center gap-2">
                  <Clock className={`h-3.5 w-3.5 ${replied ? 'text-success' : 'text-warning'}`} />
                  <span className={replied ? 'text-success' : 'text-warning'}>
                    {replied ? 'Met · 1m 12s' : 'First reply due in 4m'}
                  </span>
                </div>
              </div>
              <div className="border-line mt-auto rounded-xl border bg-white/[0.02] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#b3a8ff]">
                  <Sparkle className="h-3 w-3" /> Suggested macro
                </p>
                <p className="text-muted-foreground mt-1.5">/shipping-eta</p>
              </div>
            </aside>
          </div>
        </div>

        {/* ── Floating cards at Z depth ─────────────────────────────── */}
        <FloatCard
          show={showSummary}
          className="left-[-2%] top-[18%] hidden w-[250px] md:block"
          z={110}
          delay={0}
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#b3a8ff]">
            <Sparkle className="h-3 w-3" /> AI summary
          </p>
          <p className="text-foreground/90 mt-2 text-[12.5px] leading-relaxed">
            Jordan wants a ship date for <span className="text-accent-soft">#4821</span>. Paid,
            label printed — ships today.
          </p>
          <div className="mt-2.5 flex gap-1">
            <Tag tone="violet">Order</Tag>
            <Tag tone="success">Positive</Tag>
          </div>
        </FloatCard>

        <FloatCard
          show={showAssigned}
          className="right-[-3%] top-[8%] hidden md:block"
          z={150}
          delay={60}
        >
          <div className="flex items-center gap-2.5">
            <Avatar name="Maya Patel" size={26} tone={3} />
            <div>
              <p className="text-[12.5px] font-medium">Assigned to Maya</p>
              <p className="text-subtle text-[11px]">Round-robin · Orders</p>
            </div>
          </div>
        </FloatCard>

        <FloatCard
          show={!interactive && ['sent', 'react', 'rest'].includes(beat)}
          className="bottom-[10%] right-[-2%] hidden md:block"
          z={130}
          delay={0}
        >
          <div className="flex items-center gap-2.5">
            <span className="bg-success/15 text-success grid h-7 w-7 place-items-center rounded-full">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[12.5px] font-medium">SLA met</p>
              <p className="text-subtle text-[11px]">First reply in 1m 12s</p>
            </div>
          </div>
        </FloatCard>

        <FloatCard
          show={!interactive && beat === 'typing'}
          className="bottom-[16%] left-[3%] hidden md:block"
          z={90}
          delay={0}
        >
          <div className="flex items-center gap-2 text-[12px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-ring bg-accent absolute inline-flex h-full w-full rounded-full" />
              <span className="bg-accent relative inline-flex h-2 w-2 rounded-full" />
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground">Maya</span> is replying — Sam’s composer is locked
            </span>
          </div>
        </FloatCard>
      </div>

      {interactive && (
        <p className="animate-rise text-subtle mt-5 text-center text-xs">
          You’re driving. Switch threads, click the status, type a reply.
        </p>
      )}
    </div>
  );
}

function FloatCard({
  show,
  z,
  delay,
  className,
  children,
}: {
  show: boolean;
  z: number;
  delay: number;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!show}
      className={`glass ease-out-expo pointer-events-none absolute rounded-2xl p-3.5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] transition-[opacity,transform,filter] duration-700 ${className}`}
      style={{
        transform: `translate3d(0, ${show ? 0 : 14}px, ${show ? z : z - 60}px) scale(${show ? 1 : 0.94})`,
        opacity: show ? 1 : 0,
        filter: show ? 'none' : 'blur(6px)',
        transitionDelay: `${delay}ms`,
        background: 'linear-gradient(180deg, rgb(30 33 40 / 0.82), rgb(18 20 25 / 0.82))',
      }}
    >
      {children}
    </div>
  );
}

function pickReply(text: string): string {
  const t = text.toLowerCase();
  if (/thank|thx|ty\b/.test(t)) return 'Anytime! You all are the best 🙌';
  if (/\?/.test(t)) return 'Good question — let me check and get back to you.';
  if (/sorry|apolog/.test(t)) return 'No worries at all, thanks for sorting it!';
  return 'Perfect, thank you! 🙏';
}
