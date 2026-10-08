'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from '@/lib/motion';
import { Avatar, Bubble, StatusPill, Tag, TypingBubble } from './chat';
import { Sparkle, Send, Bolt } from '@/components/ui/icons';

/**
 * "Be the customer." A phone on the left runs plain iMessage; the team's desk
 * on the right receives the same thread as a ticket. Type on the phone and
 * watch it land, get auto-tagged, and get answered — the whole product's
 * promise in one gesture. Nothing leaves the browser.
 */

type Line = { id: number; from: 'customer' | 'team'; text: string };

const SUGGESTIONS = ['Where’s my order?', 'Can I get a refund?', 'Are you open Sunday?'];

function triage(text: string): { tag: string; macro: string; reply: string } {
  const t = text.toLowerCase();
  if (/refund|money back|charge|return/.test(t))
    return {
      tag: 'Billing',
      macro: '/refund-policy',
      reply: 'Absolutely — I’ve started your refund. You’ll see it in 3–5 business days 💸',
    };
  if (/order|ship|track|deliver|package/.test(t))
    return {
      tag: 'Order',
      macro: '/shipping-eta',
      reply: 'Your order shipped this morning! Here’s tracking: ups.com/1Z…84 📦',
    };
  if (/open|hours|sunday|saturday|today|close/.test(t))
    return {
      tag: 'Hours',
      macro: '/store-hours',
      reply: 'We’re open Sunday 10am–4pm. See you then! ☀️',
    };
  return {
    tag: 'General',
    macro: '/thanks',
    reply: 'Thanks for reaching out — happy to help with that! 😊',
  };
}

export function LiveDemo() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [lines, setLines] = useState<Line[]>([
    { id: 1, from: 'customer', text: 'Hi! Do you ship to Canada?' },
    { id: 2, from: 'team', text: 'We do — free over $50 🇨🇦' },
  ]);
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'idle' | 'arriving' | 'triaged' | 'typing'>('idle');
  const [meta, setMeta] = useState<{ tag: string; macro: string } | null>(null);
  const timers = useRef<number[]>([]);
  const started = useRef(false);

  const later = (ms: number, fn: () => void) =>
    timers.current.push(window.setTimeout(fn, reduced ? 0 : ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  function send(raw: string) {
    const text = raw.trim();
    if (!text || phase !== 'idle') return;
    setDraft('');
    const id = Date.now();
    const t = triage(text);
    setLines((l) => [...l.slice(-4), { id, from: 'customer', text }]);
    setPhase('arriving');
    later(650, () => {
      setMeta({ tag: t.tag, macro: t.macro });
      setPhase('triaged');
    });
    later(1700, () => setPhase('typing'));
    later(3300, () => {
      setLines((l) => [...l, { id: id + 1, from: 'team', text: t.reply }]);
      setPhase('idle');
    });
  }

  // Play one round on its own the first time it scrolls into view.
  useEffect(() => {
    if (inView && !started.current) {
      started.current = true;
      later(900, () => send('Where’s my order?'));
    }
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = lines[lines.length - 1];

  return (
    <div
      ref={ref}
      className="grid items-center gap-10 lg:grid-cols-[minmax(0,380px)_auto_minmax(0,1fr)] lg:gap-6"
    >
      {/* ── Phone ─────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[340px] [perspective:1400px]">
        <div className="ease-out-expo relative rounded-[48px] bg-gradient-to-b from-[#3a3d44] to-[#17191d] p-[10px] shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.15)] transition-transform duration-700 lg:[transform:rotateY(14deg)_rotateX(2deg)] lg:hover:[transform:rotateY(4deg)]">
          <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[39px] bg-black">
            <div className="absolute left-1/2 top-2.5 z-10 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/5" />
            <div className="flex items-center justify-between px-7 pt-3.5 text-[12px] font-semibold">
              <span>9:41</span>
              <span className="flex gap-1">
                <span className="h-2.5 w-4 rounded-sm border border-white/70" />
              </span>
            </div>
            <div className="mt-5 flex flex-col items-center border-b border-white/[0.06] pb-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-[#9aa0aa] to-[#6b717c] text-[15px] font-semibold">
                AC
              </span>
              <p className="text-muted-foreground mt-1 text-[11px]">Acme Support ›</p>
            </div>
            <div className="no-scrollbar flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3 pb-3">
              <p className="text-subtle mb-1 text-center text-[10px]">iMessage · Today 9:41 AM</p>
              {lines.map((l) => (
                <div key={l.id} className="animate-pop">
                  <Bubble side={l.from === 'customer' ? 'out' : 'in'}>{l.text}</Bubble>
                </div>
              ))}
              {phase === 'typing' && <TypingBubble />}
              {last?.from === 'customer' && phase !== 'typing' && (
                <p className="text-subtle text-right text-[10px]">Delivered</p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 px-3 pb-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={phase !== 'idle'}
                  className="text-muted-foreground hover:border-accent/40 hover:text-foreground rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] transition-all disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="mx-3 mb-5 flex items-center gap-2 rounded-full border border-white/15 py-1 pl-3.5 pr-1"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="iMessage"
                aria-label="Text the business as a customer"
                className="placeholder:text-subtle min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
              <button
                aria-label="Send"
                className={`grid h-7 w-7 place-items-center rounded-full transition-all ${draft.trim() ? 'bg-accent text-white' : 'text-subtle bg-white/10'}`}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
        <p className="text-subtle mt-4 text-center text-xs">
          The customer’s view — plain iMessage. Try typing.
        </p>
      </div>

      {/* ── Connector ─────────────────────────────────────────────── */}
      <div className="relative mx-auto hidden h-px w-24 lg:block" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/20 to-white/5" />
        <span
          key={last?.id}
          className={`absolute -top-[3px] h-[7px] w-[7px] rounded-full shadow-[0_0_12px_rgb(var(--accent))] ${
            last?.from === 'customer' ? 'bg-accent' : 'bg-success'
          }`}
          style={{
            animation: `${last?.from === 'customer' ? 'travel-r' : 'travel-l'} 0.7s cubic-bezier(0.16,1,0.3,1) both`,
          }}
        />
        <style>{`@keyframes travel-r{from{left:0;opacity:0}20%{opacity:1}to{left:calc(100% - 7px);opacity:0}}@keyframes travel-l{from{left:calc(100% - 7px);opacity:0}20%{opacity:1}to{left:0;opacity:0}}`}</style>
      </div>

      {/* ── Team desk ─────────────────────────────────────────────── */}
      <div className="panel relative overflow-hidden rounded-3xl shadow-[0_40px_100px_-40px_rgb(0_0_0/0.9)]">
        <div className="border-line flex items-center gap-3 border-b px-5 py-3.5">
          <Avatar name="Riley Morgan" size={30} tone={1} />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">Riley Morgan</p>
            <p className="text-subtle text-[11px]">iMessage · +1 (206) 555-0123</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {meta && (
              <span key={meta.tag} className="animate-pop">
                <Tag tone="accent">{meta.tag}</Tag>
              </span>
            )}
            <StatusPill status={phase === 'idle' && last?.from === 'team' ? 'pending' : 'open'} />
          </div>
        </div>

        <div className="grid min-h-[380px] md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="flex flex-col justify-end gap-2.5 p-5">
            {lines.map((l) => (
              <div key={l.id} className="animate-pop">
                <Bubble
                  side={l.from === 'customer' ? 'in' : 'out'}
                  meta={l.from === 'team' ? 'Maya · Delivered' : undefined}
                >
                  {l.text}
                </Bubble>
              </div>
            ))}
            {phase === 'typing' && (
              <div className="animate-pop text-subtle flex items-center justify-end gap-2 text-[11px]">
                Maya is replying
                <TypingBubble side="out" />
              </div>
            )}
          </div>

          <aside className="border-line space-y-3 border-t p-4 text-[12px] md:border-l md:border-t-0">
            <Step
              on={phase !== 'idle' || !!meta}
              icon={<Bolt className="h-3 w-3" />}
              title="Arrived"
              body="Webhook from your Mac, in under a second."
            />
            <Step
              on={phase === 'triaged' || phase === 'typing' || (phase === 'idle' && !!meta)}
              icon={<Sparkle className="h-3 w-3" />}
              title="Triaged"
              body={
                meta ? `Tagged ${meta.tag}, assigned to Maya` : 'Tagged and routed by rule or AI'
              }
            />
            <Step
              on={phase === 'typing' || (phase === 'idle' && !!meta)}
              icon={<span className="text-[10px] font-semibold">/</span>}
              title="Answered"
              body={meta ? `Maya used ${meta.macro}` : 'A macro fills the reply'}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Step({
  on,
  icon,
  title,
  body,
}: {
  on: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className={`ease-out-expo flex gap-2.5 transition-all duration-500 ${on ? 'opacity-100' : 'opacity-35'}`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors duration-500 ${
          on
            ? 'bg-accent text-white shadow-[0_0_14px_rgb(var(--accent)/0.6)]'
            : 'text-subtle bg-white/[0.06]'
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">{body}</p>
      </div>
    </div>
  );
}
