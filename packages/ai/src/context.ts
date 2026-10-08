import { ageLabel, formatTranscript, type TranscriptMessage } from './transcript.js';

/**
 * Time-aware context for a text thread.
 *
 * A flat "last 40 messages" window treats a plan made in March and a question
 * asked ten minutes ago as equally current, and a thread that went quiet for
 * months — because the conversation moved to a call, another app, or real
 * life — reads to the model as if no time had passed.
 *
 * This builds context the way long-running chat assistants do memory:
 *
 *  1. Sessions. Messages are split wherever the thread went quiet for
 *     {@link SESSION_GAP_MS}. Only the live session goes in verbatim.
 *  2. Decay. Each earlier session is weighted by recency with a half-life
 *     ({@link HALF_LIFE_DAYS}); heavier ones are kept as a short digest of
 *     their most informative lines, and ones that have decayed below
 *     {@link MIN_WEIGHT} are left out entirely.
 *  3. Recall. Older lines come back only when the live exchange mentions the
 *     same things — scored by term overlap × recency, so an old topic
 *     resurfaces when the conversation points at it and stays buried when it
 *     does not.
 *  4. Gaps. A long silence before the live session is stated outright, with
 *     the instruction that the two people may have been in touch elsewhere.
 *
 * Everything here is deterministic and model-free, so it costs no extra calls
 * and is unit-tested directly.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A quiet stretch this long ends one session and starts the next. */
export const SESSION_GAP_MS = 6 * HOUR;
/** An earlier session's weight halves every this many days. */
export const HALF_LIFE_DAYS = 14;
/** Sessions weighted below this are omitted (≈ 2 months at a 14-day half-life). */
export const MIN_WEIGHT = 0.05;
/** A silence at least this long before the live session gets an explicit notice. */
export const LONG_GAP_MS = 7 * DAY;

const MAX_LIVE_MESSAGES = 40;
const MAX_DIGEST_SESSIONS = 6;
const DIGEST_LINES_PER_SESSION = 2;
const MAX_RECALLED = 4;
const SNIPPET_CHARS = 160;

export interface Session {
  messages: TranscriptMessage[];
  start: Date | null;
  end: Date | null;
}

function toDate(at: TranscriptMessage['at']): Date | null {
  if (!at) return null;
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Recency weight in (0, 1]: 1 now, 0.5 one half-life ago, and so on. */
export function recencyWeight(at: Date | null, now: Date, halfLifeDays = HALF_LIFE_DAYS): number {
  if (!at) return 1;
  const days = Math.max(0, now.getTime() - at.getTime()) / DAY;
  return Math.pow(0.5, days / halfLifeDays);
}

/**
 * Split a chronological transcript into sessions at every quiet stretch of at
 * least `gapMs`. Messages without a timestamp stay in the session they sit in.
 */
export function splitSessions(messages: TranscriptMessage[], gapMs = SESSION_GAP_MS): Session[] {
  const sessions: Session[] = [];
  let current: Session | null = null;
  let lastAt: Date | null = null;
  for (const m of messages) {
    const at = toDate(m.at);
    const breaks = current && at && lastAt && at.getTime() - lastAt.getTime() >= gapMs;
    if (!current || breaks) {
      current = { messages: [], start: at, end: at };
      sessions.push(current);
    }
    current.messages.push(m);
    if (at) {
      current.start ??= at;
      current.end = at;
      lastAt = at;
    }
  }
  return sessions;
}

const STOP = new Set(
  (
    'the and for are but not you your yours with this that have has had was were will would could should ' +
    'just about what when where which who whom how why there their them they then than from into onto ' +
    'okay yeah yes sure thanks thank please hey hello still also really maybe some any all can cant dont ' +
    'its it’s i’m im ill ive we’re were youre going gonna want need like know think make made does did done ' +
    'today tomorrow tonight morning night week here been being only very much more most well good great'
  ).split(/\s+/),
);

/** Content words worth matching on: lowercase, 4+ letters or any number, minus stop words. */
export function keyTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9$£€][a-z0-9'’.$£€-]*/g) ?? [];
  const out = new Set<string>();
  for (const raw of words) {
    const w = raw.replace(/[.'’-]+$/, '');
    if (STOP.has(w)) continue;
    if (/\d/.test(w) || w.length >= 4) out.add(w);
  }
  return [...out];
}

/**
 * How much a line carries that a later reply might depend on: questions,
 * numbers, money, dates and times, commitments. Used to pick which lines of
 * an old session survive into its digest.
 */
export function salience(text: string): number {
  const t = text.toLowerCase();
  let s = 0;
  if (t.includes('?')) s += 2;
  if (/\d/.test(t)) s += 2;
  if (/[$£€]|\b(price|cost|paid|pay|deposit|refund|invoice|order)\b/.test(t)) s += 2;
  if (
    /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(am|pm)\b/.test(
      t,
    )
  )
    s += 1.5;
  if (
    /\b(will|promise|agreed|confirm|booked|scheduled|deadline|by then|send you|get back)\b/.test(t)
  )
    s += 1.5;
  // Long enough to say something, short enough to be one thought.
  s += Math.min(text.length, 160) / 160;
  return s;
}

function speaker(m: TranscriptMessage, contactName?: string | null): string {
  if (m.role === 'contact') return contactName ?? 'Customer';
  if (m.role === 'agent') return m.author ? `Agent (${m.author})` : 'Agent';
  if (m.role === 'note') return '[internal note]';
  return '[system]';
}

function snippet(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > SNIPPET_CHARS ? `${one.slice(0, SNIPPET_CHARS - 1)}…` : one;
}

function durationLabel(ms: number): string {
  const days = Math.round(ms / DAY);
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months`;
  return `${Math.round(days / 365)} years`;
}

/** The headings the prompts refer to by name. */
export const CONTEXT_HEADINGS = {
  earlier: '== Earlier in this thread (condensed; oldest first) ==',
  recalled: '== From further back, mentioning the same things ==',
  current: '== Current conversation ==',
} as const;

export interface ContextOptions {
  now?: Date;
  /** Draw the RECENT_MARKER before the last N messages of the live session. */
  recentCount?: number;
  /** Override the session gap (tests, or channels with a different rhythm). */
  sessionGapMs?: number;
}

/**
 * Render a thread as time-aware context: today's date, a condensed and
 * decayed view of earlier sessions, any older lines the live exchange points
 * back to, a notice for long silences, and the live session verbatim.
 */
export function formatContext(
  messages: TranscriptMessage[],
  contactName?: string | null,
  opts: ContextOptions = {},
): string {
  const now = opts.now ?? new Date();
  const kept = messages.filter((m) => m.text && m.text.trim());
  if (kept.length === 0) return '';

  const sessions = splitSessions(kept, opts.sessionGapMs ?? SESSION_GAP_MS);

  // The live session is the last one. A short follow-up ("also, …") on the
  // heels of the previous session is part of that exchange, not a new one.
  let liveFrom = sessions.length - 1;
  const last = sessions[liveFrom]!;
  const prev = sessions[liveFrom - 1];
  if (
    prev &&
    last.messages.length < 3 &&
    last.start &&
    prev.end &&
    last.start.getTime() - prev.end.getTime() < 2 * DAY
  ) {
    liveFrom -= 1;
  }

  let live = sessions.slice(liveFrom).flatMap((s) => s.messages);
  let earlier = sessions.slice(0, liveFrom);
  // A live session longer than the cap spills its head into "earlier".
  if (live.length > MAX_LIVE_MESSAGES) {
    const spill = live.slice(0, live.length - MAX_LIVE_MESSAGES);
    live = live.slice(-MAX_LIVE_MESSAGES);
    earlier = [...earlier, ...splitSessions(spill, opts.sessionGapMs ?? SESSION_GAP_MS)];
  }

  const lines: string[] = [`Today is ${now.toUTCString().slice(0, 16)}.`];
  const shown = new Set<TranscriptMessage>(live);

  // ── Earlier sessions: decayed, condensed ────────────────────────────────
  const digests: { at: Date | null; text: string }[] = [];
  for (const s of [...earlier].reverse()) {
    if (digests.length >= MAX_DIGEST_SESSIONS) break;
    const w = recencyWeight(s.end, now);
    if (w < MIN_WEIGHT) break; // older sessions only weigh less
    const picks = s.messages
      .map((m, i) => ({ m, i, score: salience(m.text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DIGEST_LINES_PER_SESSION)
      .sort((a, b) => a.i - b.i);
    picks.forEach((p) => shown.add(p.m));
    const age = s.end ? ageLabel(s.end, now) : 'earlier';
    const n = s.messages.length;
    const body = picks.map((p) => `${speaker(p.m, contactName)}: ${snippet(p.m.text)}`).join(' / ');
    digests.push({ at: s.end, text: `[${age} · ${n} message${n === 1 ? '' : 's'}] ${body}` });
  }
  if (digests.length) {
    lines.push('', CONTEXT_HEADINGS.earlier, ...digests.reverse().map((d) => d.text));
  }

  // ── Recall: older lines the live exchange points back to ────────────────
  const lastContact =
    [...live].reverse().find((m) => m.role === 'contact') ?? live[live.length - 1]!;
  const query = new Set(keyTerms(lastContact.text));
  if (query.size) {
    const candidates = earlier
      .flatMap((s) => s.messages)
      .filter((m) => !shown.has(m))
      .map((m) => {
        const terms = keyTerms(m.text);
        const hits = terms.filter((t) => query.has(t));
        // At least one distinctive shared term: a number, or a word of 5+ letters.
        const distinctive = hits.some((t) => /\d/.test(t) || t.length >= 5);
        const relevance = hits.length / Math.sqrt(query.size);
        // Recency still counts, but with a floor: a clear reference to
        // something old is exactly the case recall exists for.
        const score = relevance * (0.3 + 0.7 * recencyWeight(toDate(m.at), now));
        return { m, score, ok: distinctive && hits.length > 0 };
      })
      .filter((c) => c.ok && c.score >= 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECALLED)
      .sort((a, b) => (toDate(a.m.at)?.getTime() ?? 0) - (toDate(b.m.at)?.getTime() ?? 0));
    if (candidates.length) {
      lines.push(
        '',
        CONTEXT_HEADINGS.recalled,
        ...candidates.map((c) => {
          const at = toDate(c.m.at);
          return `[${at ? ageLabel(at, now) : 'earlier'}] ${speaker(c.m, contactName)}: ${snippet(c.m.text)}`;
        }),
      );
    }
  }

  // ── Long silence before the live session ────────────────────────────────
  const liveStart = toDate(live[0]!.at);
  const before = earlier.length ? earlier[earlier.length - 1]!.end : null;
  lines.push('', CONTEXT_HEADINGS.current);
  if (liveStart && before && liveStart.getTime() - before.getTime() >= LONG_GAP_MS) {
    lines.push(
      `[No messages in this thread for ${durationLabel(liveStart.getTime() - before.getTime())} before this. ` +
        'They may have been in touch elsewhere since (in person, a call, another app), so treat anything older as possibly out of date.]',
    );
  }
  lines.push(formatTranscript(live, contactName, { now, recentCount: opts.recentCount }));

  return lines.join('\n');
}
