/**
 * Presentational pieces of the product shared by every demo on the page:
 * avatars, message bubbles, status pills. They mirror the app's real UI, but
 * are rebuilt here so the marketing site stays free of workspace packages.
 */

const AVATAR_TONES = [
  'from-[#64AAFF] to-[#3D6BFF]',
  'from-[#FF9F7A] to-[#FF5E62]',
  'from-[#7CE0B5] to-[#21A67A]',
  'from-[#C3A6FF] to-[#7C6CFF]',
  'from-[#FFD36E] to-[#F59E0B]',
  'from-[#9AE6FF] to-[#22B8CF]',
];

export function Avatar({
  name,
  size = 28,
  tone,
  ring = false,
}: {
  name: string;
  size?: number;
  tone?: number;
  ring?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const t = tone ?? [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length;
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white ${AVATAR_TONES[t]} ${
        ring ? 'ring-2 ring-[rgb(var(--surface))]' : ''
      }`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export type Side = 'in' | 'out' | 'note';

export function Bubble({
  side,
  children,
  meta,
  reaction,
  className = '',
}: {
  side: Side;
  children: React.ReactNode;
  meta?: React.ReactNode;
  reaction?: string;
  className?: string;
}) {
  const base = 'relative max-w-[78%] rounded-[18px] px-3.5 py-2 text-[13px] leading-snug';
  const tone =
    side === 'out'
      ? 'ml-auto bg-gradient-to-b from-[#1a8dff] to-[#0a7cff] text-white rounded-br-md'
      : side === 'note'
        ? 'mx-auto max-w-[88%] rounded-xl border border-warning/25 bg-warning/[0.08] text-[12px] text-[#ffd98a]'
        : 'bg-[#26292f] text-foreground rounded-bl-md';
  return (
    <div
      className={`flex flex-col ${side === 'out' ? 'items-end' : side === 'note' ? 'items-center' : 'items-start'} ${className}`}
    >
      <div className={`${base} ${tone}`}>
        {children}
        {reaction ? (
          <span className="animate-pop absolute -left-2 -top-3 grid h-6 w-6 place-items-center rounded-full border border-[rgb(var(--bg))] bg-[#3a3d44] text-[11px] shadow-lg">
            {reaction}
          </span>
        ) : null}
      </div>
      {meta ? <div className="text-subtle mt-1 px-1 text-[10.5px]">{meta}</div> : null}
    </div>
  );
}

export function TypingBubble({ side = 'in' }: { side?: 'in' | 'out' }) {
  return (
    <div className={`flex ${side === 'out' ? 'justify-end' : ''}`}>
      <div
        className={`animate-pop flex items-center gap-1 rounded-[18px] px-3.5 py-3 ${
          side === 'out' ? 'bg-[#0a7cff]/80' : 'bg-[#26292f]'
        }`}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot h-1.5 w-1.5 rounded-full bg-white/80"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export type Status = 'open' | 'pending' | 'snoozed' | 'closed';

const STATUS_STYLE: Record<Status, string> = {
  open: 'bg-accent/15 text-accent-soft ring-accent/30',
  pending: 'bg-warning/15 text-warning ring-warning/30',
  snoozed: 'bg-violet/15 text-[#b3a8ff] ring-violet/30',
  closed: 'bg-white/[0.06] text-muted-foreground ring-white/10',
};

export function StatusPill({ status, onClick }: { status: Status; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset transition-colors ${STATUS_STYLE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </Tag>
  );
}

export function Tag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'violet' | 'success';
}) {
  const t =
    tone === 'accent'
      ? 'bg-accent/10 text-accent-soft ring-accent/25'
      : tone === 'violet'
        ? 'bg-violet/10 text-[#b3a8ff] ring-violet/25'
        : tone === 'success'
          ? 'bg-success/10 text-success ring-success/25'
          : 'bg-white/[0.05] text-muted-foreground ring-white/10';
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${t}`}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="text-muted-foreground inline-grid h-5 min-w-5 place-items-center rounded border border-white/10 bg-white/[0.04] px-1 font-sans text-[10.5px]">
      {children}
    </kbd>
  );
}
