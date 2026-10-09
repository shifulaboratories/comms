import {
  and,
  desc,
  eq,
  inArray,
  getDb,
  getRuntimeOverrides,
  appSettings,
  contactFacts,
  conversations,
  conversationSessions,
  messageEmbeddings,
  messages,
  users,
} from '@comms/db';
import type { TranscriptMessage } from './transcript.js';
import { CONTEXT_DEFAULTS, keyTerms, type ContactFact, type StoredSession } from './context.js';
import type { ContextInput } from './features.js';
import { cosine, embedTexts, embeddingsConfig } from './embeddings.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * How many raw messages are read. The cap is on rows, not on what reaches the
 * model: formatContext keeps only the live session verbatim and decides how
 * much of the rest is worth a digest line or a recalled quote, weighting by
 * age. Reading a few hundred rows is what lets an old reference be found.
 */
export const TRANSCRIPT_FETCH = 400;

/** The session gap, half-life and long-gap threshold in effect right now. */
export async function contextTuning(): Promise<{
  sessionGapMs: number;
  halfLifeDays: number;
  longGapMs: number;
}> {
  const o = await getRuntimeOverrides();
  return {
    sessionGapMs: (o.contextSessionGapHours ?? CONTEXT_DEFAULTS.sessionGapHours) * HOUR,
    halfLifeDays: o.contextHalfLifeDays ?? CONTEXT_DEFAULTS.halfLifeDays,
    longGapMs: (o.contextLongGapDays ?? CONTEXT_DEFAULTS.longGapDays) * DAY,
  };
}

/**
 * The time zone "today" is computed in: the acting user's preference, else
 * the workspace's business-hours zone, else none (UTC).
 */
export async function resolveTimeZone(userId?: string | null): Promise<string | null> {
  const db = getDb();
  if (userId) {
    const u = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { preferences: true },
    });
    const tz = u?.preferences?.timeZone;
    if (tz) return tz;
  }
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'business_hours'),
  });
  const tz = (row?.value as { timezone?: string } | null)?.timezone;
  return tz || null;
}

export interface LoadedConversation {
  contactId: string | null;
  contactName: string | null;
  transcript: TranscriptMessage[];
  /** Everything formatContext can use beyond the messages themselves. */
  context: ContextInput;
}

/**
 * Load a conversation in the shape every AI feature wants: the recent
 * transcript plus memory (stored session summaries, facts, team notes),
 * similarity scores when embeddings are configured, the time zone, and the
 * admin's tuning.
 *
 * `semantic: false` skips the embeddings call — for latency-sensitive paths
 * like inline completion, where a network round-trip per keystroke pause is
 * not worth what it adds.
 */
export async function loadConversationForAi(
  conversationId: string,
  opts: { userId?: string | null; semantic?: boolean } = {},
): Promise<LoadedConversation | null> {
  const db = getDb();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { id: true, contactId: true },
    with: { contact: { columns: { displayName: true, notes: true } } },
  });
  if (!conv) return null;

  const [rows, tuning, timeZone, sessionRows, factRows] = await Promise.all([
    db.query.messages.findMany({
      where: and(eq(messages.conversationId, conversationId), eq(messages.isRetracted, false)),
      orderBy: [desc(messages.createdAt)],
      limit: TRANSCRIPT_FETCH,
      with: { authorUser: { columns: { name: true } } },
    }),
    contextTuning(),
    resolveTimeZone(opts.userId),
    db.query.conversationSessions.findMany({
      where: eq(conversationSessions.conversationId, conversationId),
      orderBy: [desc(conversationSessions.endedAt)],
      limit: 30,
    }),
    conv.contactId
      ? db.query.contactFacts.findMany({ where: eq(contactFacts.contactId, conv.contactId) })
      : Promise.resolve([]),
  ]);

  const transcript: TranscriptMessage[] = rows
    // Back to chronological: the prompts all say "oldest first", and an age
    // marker only means anything if the messages under it run forwards.
    .reverse()
    .filter((m) => m.authorType !== 'system' && (m.body ?? '').trim())
    .map((m) => ({
      id: m.id,
      role: m.authorType === 'contact' ? 'contact' : m.isPrivateNote ? 'note' : 'agent',
      author: m.authorUser?.name ?? null,
      text: m.body ?? '',
      at: m.createdAt,
    }));

  const sessionSummaries: StoredSession[] = sessionRows.map((s) => ({
    start: s.startedAt,
    end: s.endedAt,
    messageCount: s.messageCount,
    summary: s.summary,
  }));
  const facts: ContactFact[] = factRows
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((f) => ({ key: f.key, value: f.value, learnedAt: f.learnedAt, source: f.source }));

  let semanticScores: Map<string, number> | undefined;
  if (opts.semantic !== false) {
    semanticScores = await similarityToLatest(conversationId, transcript).catch(() => undefined);
  }

  return {
    contactId: conv.contactId,
    contactName: conv.contact?.displayName ?? null,
    transcript,
    context: {
      ...tuning,
      timeZone,
      sessionSummaries,
      facts,
      notes: conv.contact?.notes ?? null,
      semanticScores,
    },
  };
}

/**
 * Cosine similarity of each embedded message in the thread to the latest
 * message from the other person. One embeddings call; the message vectors
 * were written ahead of time by the worker.
 *
 * Texts often ask two things at once ("is the cabin free? and did we ever get
 * that money back?"), and one vector for the whole message sits between the
 * topics, close to neither. So each sentence is embedded too, and a stored
 * message scores by its best match against any of them.
 */
async function similarityToLatest(
  conversationId: string,
  transcript: TranscriptMessage[],
): Promise<Map<string, number> | undefined> {
  const cfg = embeddingsConfig();
  if (!cfg) return undefined;
  const latest = [...transcript].reverse().find((m) => m.role === 'contact');
  if (!latest?.text.trim()) return undefined;
  const ids = transcript.filter((m) => m.id && m !== latest).map((m) => m.id!);
  if (ids.length === 0) return undefined;

  const db = getDb();
  const stored = await db
    .select({ id: messageEmbeddings.messageId, v: messageEmbeddings.embedding })
    .from(messageEmbeddings)
    .where(
      and(
        eq(messageEmbeddings.conversationId, conversationId),
        eq(messageEmbeddings.model, cfg.model),
        inArray(messageEmbeddings.messageId, ids),
      ),
    );
  if (stored.length === 0) return undefined;
  const queries = await embedTexts(queryPieces(latest.text), cfg);
  if (queries.length === 0) return undefined;
  return new Map(stored.map((r) => [r.id, Math.max(...queries.map((q) => cosine(q, r.v)))]));
}

/**
 * The whole message plus each sentence substantial enough to carry a topic.
 * A greeting ("hiii long time.") is left out: on its own it matches every
 * other pleasantry in the thread.
 */
export function queryPieces(text: string): string[] {
  const whole = text.trim();
  const sentences = whole
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && keyTerms(s).length >= 2);
  return sentences.length > 1 ? [whole, ...sentences.slice(0, 4)] : [whole];
}
