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
 *  5. Memory. When the caller has them, stored AI summaries of past sessions
 *     replace the extractive digest (and reach back past the rows that were
 *     read), durable facts about the person head the context, and
 *     embedding similarity joins term overlap in deciding what to recall.
 *
 * This function itself is deterministic and model-free; the summaries, facts
 * and similarity scores it can use are produced elsewhere and passed in.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Defaults for the three values an admin can tune (see RuntimeOverrides). */
export const CONTEXT_DEFAULTS = { sessionGapHours: 6, halfLifeDays: 14, longGapDays: 7 } as const;

/** A quiet stretch this long ends one session and starts the next. */
export const SESSION_GAP_MS = CONTEXT_DEFAULTS.sessionGapHours * HOUR;
/** An earlier session's weight halves every this many days. */
export const HALF_LIFE_DAYS = CONTEXT_DEFAULTS.halfLifeDays;
/** Sessions weighted below this are omitted (≈ 2 months at a 14-day half-life). */
export const MIN_WEIGHT = 0.05;
/** A silence at least this long before the live session gets an explicit notice. */
export const LONG_GAP_MS = CONTEXT_DEFAULTS.longGapDays * DAY;

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
export function recencyWeight(
  at: Date | null,
  now: Date,
  halfLifeDays: number = HALF_LIFE_DAYS,
): number {
  if (!at) return 1;
  const days = Math.max(0, now.getTime() - at.getTime()) / DAY;
  return Math.pow(0.5, days / halfLifeDays);
}

/**
 * Split a chronological transcript into sessions at every quiet stretch of at
 * least `gapMs`. Messages without a timestamp stay in the session they sit in.
 */
export function splitSessions(
  messages: TranscriptMessage[],
  gapMs: number = SESSION_GAP_MS,
): Session[] {
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

/**
 * A deliberately light stemmer: enough that "booked", "booking" and
 * "bookings" meet at "book", not so much that unrelated words collide.
 * Numbers and short words pass through untouched.
 */
export function stem(w: string): string {
  if (/\d/.test(w) || w.length <= 4) return w;
  let s = w;
  // Plural first, then tense/aspect, so "bookings" → "booking" → "book".
  if (s.endsWith('ies') && s.length > 5) s = `${s.slice(0, -3)}y`;
  else if (/(ss|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 6) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 5) s = s.slice(0, -2);
  return s;
}

/**
 * Content words worth matching on: lowercase, 4+ letters or any number, minus
 * stop words, stemmed.
 */
export function keyTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9$£€][a-z0-9'’.$£€-]*/g) ?? [];
  const out = new Set<string>();
  for (const raw of words) {
    const w = raw.replace(/[.'’-]+$/, '');
    if (STOP.has(w)) continue;
    if (/\d/.test(w) || w.length >= 4) out.add(stem(w));
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
  profile: '== What you know about this person (may be out of date) ==',
  earlier: '== Earlier in this thread (condensed; oldest first) ==',
  recalled: '== From further back, mentioning the same things ==',
  current: '== Current conversation ==',
} as const;

/** A past session as summarized and stored by the worker. */
export interface StoredSession {
  start: Date | string;
  end: Date | string;
  messageCount: number;
  summary: string;
}

/** A durable fact about the person, with when it was said. */
export interface ContactFact {
  key: string;
  value: string;
  learnedAt?: Date | string | null;
  source?: 'ai' | 'human';
}

export interface ContextOptions {
  now?: Date;
  /** Draw the RECENT_MARKER before the last N messages of the live session. */
  recentCount?: number;
  /** A quiet stretch this long ends a session. */
  sessionGapMs?: number;
  /** An earlier session's weight halves every this many days. */
  halfLifeDays?: number;
  /** A silence at least this long before the live session is called out. */
  longGapMs?: number;
  /** IANA time zone for "today" (the user's or the workspace's). Defaults to UTC. */
  timeZone?: string | null;
  /** Stored summaries of past sessions, any order. */
  sessionSummaries?: StoredSession[];
  /** Durable facts about the person. */
  facts?: ContactFact[];
  /** The team's free-text notes on the person. */
  notes?: string | null;
  /**
   * Embedding similarity (cosine, roughly 0–1) of older messages to the live
   * exchange, keyed by message id. Optional: without it recall is lexical.
   */
  semanticScores?: Map<string, number>;
}

/** "Today is Thursday, October 9, 2026, 9:41 PM (America/Los_Angeles)." */
export function todayLine(now: Date, timeZone?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  if (timeZone) {
    try {
      return `Today is ${new Intl.DateTimeFormat('en-US', { ...opts, timeZone }).format(now)} (${timeZone}).`;
    } catch {
      // An unknown zone falls through to UTC rather than failing the AI call.
    }
  }
  return `Today is ${new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(now)} (UTC).`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

/**
 * Render a thread as time-aware context: today's date, what is known about
 * the person, a condensed and decayed view of earlier sessions, any older
 * lines the live exchange points back to, a notice for long silences, and the
 * live session verbatim.
 */
export function formatContext(
  messages: TranscriptMessage[],
  contactName?: string | null,
  opts: ContextOptions = {},
): string {
  const now = opts.now ?? new Date();
  const gapMs = opts.sessionGapMs ?? SESSION_GAP_MS;
  const halfLife = opts.halfLifeDays ?? HALF_LIFE_DAYS;
  const longGapMs = opts.longGapMs ?? LONG_GAP_MS;
  const kept = messages.filter((m) => m.text && m.text.trim());
  if (kept.length === 0) return '';

  const sessions = splitSessions(kept, gapMs);

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
    earlier = [...earlier, ...splitSessions(spill, gapMs)];
  }
  const liveStart = toDate(live[0]!.at);

  const lines: string[] = [todayLine(now, opts.timeZone)];
  const shown = new Set<TranscriptMessage>(live);

  // ── What is known about the person ──────────────────────────────────────
  const profile: string[] = [];
  for (const f of opts.facts ?? []) {
    if (!f.value?.trim()) continue;
    const at = toDate(f.learnedAt ?? null);
    const label = f.key.replace(/_/g, ' ');
    profile.push(`- ${label}: ${snippet(f.value)}${at ? ` (as of ${ageLabel(at, now)})` : ''}`);
  }
  if (opts.notes?.trim()) profile.push(`- team notes: ${snippet(opts.notes)}`);
  if (profile.length) lines.push('', CONTEXT_HEADINGS.profile, ...profile);

  // ── Earlier sessions: decayed, condensed ────────────────────────────────
  const stored = (opts.sessionSummaries ?? [])
    .map((s) => ({ ...s, start: toDate(s.start), end: toDate(s.end) }))
    .filter((s): s is typeof s & { start: Date; end: Date } =>
      Boolean(s.start && s.end && s.summary?.trim()),
    )
    // Never summarise the live session from storage — it is shown verbatim.
    .filter((s) => !liveStart || s.end.getTime() < liveStart.getTime());
  const usedStored = new Set<(typeof stored)[number]>();

  type Digest = {
    start?: Date | null;
    end: Date | null;
    text: string;
    picks?: TranscriptMessage[];
  };
  const items: Digest[] = [];
  for (const s of earlier) {
    const n = s.messages.length;
    const age = s.end ? ageLabel(s.end, now) : 'earlier';
    const match =
      s.start && s.end
        ? stored.find((x) => !usedStored.has(x) && overlaps(x.start, x.end, s.start!, s.end!))
        : undefined;
    if (match) {
      usedStored.add(match);
      items.push({
        start: s.start,
        end: s.end,
        text: `[${age} · ${n} message${n === 1 ? '' : 's'}] ${snippet(match.summary)}`,
      });
      continue;
    }
    const picks = s.messages
      .map((m, i) => ({ m, i, score: salience(m.text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DIGEST_LINES_PER_SESSION)
      .sort((a, b) => a.i - b.i);
    const body = picks.map((p) => `${speaker(p.m, contactName)}: ${snippet(p.m.text)}`).join(' / ');
    items.push({
      end: s.end,
      text: `[${age} · ${n} message${n === 1 ? '' : 's'}] ${body}`,
      picks: picks.map((p) => p.m),
    });
  }
  // Stored summaries of sessions older than anything that was read.
  for (const x of stored) {
    if (usedStored.has(x)) continue;
    const n = x.messageCount;
    items.push({
      start: x.start,
      end: x.end,
      text: `[${ageLabel(x.end, now)} · ${n} message${n === 1 ? '' : 's'}] ${snippet(x.summary)}`,
    });
  }
  const digests = items
    .sort((a, b) => (b.end?.getTime() ?? 0) - (a.end?.getTime() ?? 0))
    .filter((d) => recencyWeight(d.end, now, halfLife) >= MIN_WEIGHT)
    .slice(0, MAX_DIGEST_SESSIONS)
    .reverse();
  for (const d of digests) {
    for (const m of d.picks ?? []) shown.add(m);
  }
  if (digests.length) lines.push('', CONTEXT_HEADINGS.earlier, ...digests.map((d) => d.text));

  // ── Recall: older lines the live exchange points back to ────────────────
  // Candidates are old messages and the stored summaries of sessions too old
  // for the digest — a ten-month-old "booked the cabin, $500 deposit" is
  // exactly what should come back when today's message asks about it.
  const lastContact =
    [...live].reverse().find((m) => m.role === 'contact') ?? live[live.length - 1]!;
  const query = new Set(keyTerms(lastContact.text));
  const semantic = opts.semanticScores;
  const shownSummaries = new Set(digests.map((d) => d.text));
  type Candidate = {
    at: Date | null;
    line: string;
    text: string;
    id?: string;
    /** For a summary: the span it covers, so its own lines aren't recalled too. */
    span?: [number, number];
  };
  const pool: Candidate[] = [
    ...earlier
      .flatMap((s) => s.messages)
      .filter((m) => !shown.has(m))
      .map((m) => ({
        at: toDate(m.at),
        text: m.text,
        id: m.id,
        line: `${speaker(m, contactName)}: ${snippet(m.text)}`,
      })),
    ...items
      .filter((d) => !d.picks && !shownSummaries.has(d.text))
      .map((d) => ({
        at: d.end,
        span: [d.start?.getTime() ?? d.end?.getTime() ?? 0, d.end?.getTime() ?? 0] as [
          number,
          number,
        ],
        // The digest text minus its "[age · n messages] " prefix.
        text: d.text.replace(/^\[[^\]]*\]\s*/, ''),
        line: `(summary of ${d.text.match(/· (\d+ messages?)\]/)?.[1] ?? 'a session'}) ${d.text.replace(/^\[[^\]]*\]\s*/, '')}`,
      })),
  ];
  if (query.size || semantic?.size) {
    const recalled = pool
      .map((c) => {
        const hits = query.size ? keyTerms(c.text).filter((t) => query.has(t)) : [];
        // At least one distinctive shared term: a number, or a word of 5+ letters.
        const distinctive = hits.some((t) => /\d/.test(t) || t.length >= 5);
        const lexical = query.size && distinctive ? hits.length / Math.sqrt(query.size) : 0;
        // Cosine similarity runs ~0.1–0.3 for unrelated text and ~0.5–0.7 for
        // the same subject in different words; map that onto the lexical
        // scale so either signal can carry a line on its own.
        const sim = c.id ? (semantic?.get(c.id) ?? 0) : 0;
        const meaning = sim > 0.4 ? Math.min((sim - 0.4) * 3, 1.2) : 0;
        const relevance = Math.max(lexical, meaning);
        // Recency still counts, but with a floor: a clear reference to
        // something old is exactly the case recall exists for.
        const score = relevance * (0.3 + 0.7 * recencyWeight(c.at, now, halfLife));
        return { c, score };
      })
      .filter((x) => x.score >= 0.12)
      .sort((a, b) => b.score - a.score)
      // A summary and a line from the session it covers say the same thing
      // twice; keep whichever scored higher.
      .reduce<{ c: Candidate; score: number }[]>((kept, x) => {
        const within = (c: Candidate, span?: [number, number]) =>
          Boolean(span && c.at && c.at.getTime() >= span[0] && c.at.getTime() <= span[1]);
        const dup = kept.some((k) => within(x.c, k.c.span) || within(k.c, x.c.span));
        return dup || kept.length >= MAX_RECALLED ? kept : [...kept, x];
      }, [])
      .sort((a, b) => (a.c.at?.getTime() ?? 0) - (b.c.at?.getTime() ?? 0));
    if (recalled.length) {
      lines.push(
        '',
        CONTEXT_HEADINGS.recalled,
        ...recalled.map((x) => `[${x.c.at ? ageLabel(x.c.at, now) : 'earlier'}] ${x.c.line}`),
      );
    }
  }

  // ── Long silence before the live session ────────────────────────────────
  const priorEnds = [
    ...earlier.map((s) => s.end?.getTime() ?? 0),
    ...stored.map((s) => s.end.getTime()),
  ].filter((t) => t > 0 && (!liveStart || t < liveStart.getTime()));
  const before = priorEnds.length ? Math.max(...priorEnds) : null;
  lines.push('', CONTEXT_HEADINGS.current);
  if (liveStart && before && liveStart.getTime() - before >= longGapMs) {
    lines.push(
      `[No messages in this thread for ${durationLabel(liveStart.getTime() - before)} before this. ` +
        'They may have been in touch elsewhere since (in person, a call, another app), so treat anything older as possibly out of date.]',
    );
  }
  lines.push(formatTranscript(live, contactName, { now, recentCount: opts.recentCount }));

  return lines.join('\n');
}
