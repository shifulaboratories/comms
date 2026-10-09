'use server';

import { and, desc, eq, inArray, sql } from '@comms/db';
import { contacts, conversations, messageEmbeddings, messages } from '@comms/db';
import {
  answerFromArchive,
  completeMessage,
  expandSearchQuery,
  improveDraft,
  isAiConfigured,
  loadConversationForAi,
  resolveTimeZone,
  embeddingsConfig,
  embedTexts,
  cosine,
  summarizeConversation,
  suggestReply,
} from '@comms/ai';
import { db } from '@/server/db';
import { requireUser, requireWriter } from '@/lib/session';
import { conversationName } from '@/lib/naming';

export type AiResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * The conversation as every AI feature sees it — transcript plus memory,
 * similarity, time zone and tuning. Shared with the worker; see
 * loadConversationForAi in @comms/ai.
 */
function loadTranscript(conversationId: string, userId: string, opts: { semantic?: boolean } = {}) {
  return loadConversationForAi(conversationId, { userId, semantic: opts.semantic });
}

export async function summarizeConversationAction(conversationId: string): Promise<AiResult> {
  const me = await requireWriter();
  if (!(await isAiConfigured())) return { ok: false, error: 'AI is not configured.' };
  const data = await loadTranscript(conversationId, me.id);
  if (!data) return { ok: false, error: 'Conversation not found.' };
  if (data.transcript.length === 0) return { ok: false, error: 'Nothing to summarize yet.' };
  try {
    const text = await summarizeConversation({
      contactName: data.contactName,
      messages: data.transcript,
      context: data.context,
    });
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Brand-voice examples: recent real agent replies (not internal notes). */
async function loadBrandVoice(): Promise<string[]> {
  const recent = await db.query.messages.findMany({
    where: and(
      eq(messages.direction, 'outbound'),
      eq(messages.authorType, 'agent'),
      eq(messages.isPrivateNote, false),
    ),
    orderBy: [desc(messages.createdAt)],
    limit: 8,
    columns: { body: true },
  });
  return recent
    .map((m) => m.body?.trim())
    .filter((b): b is string => Boolean(b))
    .slice(0, 6);
}

export async function suggestReplyAction(conversationId: string): Promise<AiResult> {
  const me = await requireWriter();
  if (!(await isAiConfigured())) return { ok: false, error: 'AI is not configured.' };
  const data = await loadTranscript(conversationId, me.id);
  if (!data) return { ok: false, error: 'Conversation not found.' };

  try {
    const text = await suggestReply({
      contactName: data.contactName,
      messages: data.transcript,
      context: data.context,
      brandVoiceExamples: await loadBrandVoice(),
    });
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Rewrite what the caller has already typed.
 *
 * The counterpart to suggesting a reply from nothing: when you know what you
 * want to say, the useful help is polish, not a fresh draft that has to be
 * read from scratch and checked for invented facts.
 */
export async function improveDraftAction(input: {
  conversationId: string;
  draft: string;
  /** Optional steer — "shorter", "warmer", "less formal". */
  guidance?: string;
}): Promise<AiResult> {
  const me = await requireWriter();
  if (!(await isAiConfigured())) return { ok: false, error: 'AI is not configured.' };

  const draft = input.draft.trim();
  if (!draft) return { ok: false, error: 'Write something first.' };

  const data = await loadTranscript(input.conversationId, me.id);
  if (!data) return { ok: false, error: 'Conversation not found.' };

  try {
    const text = await improveDraft({
      contactName: data.contactName,
      messages: data.transcript,
      context: data.context,
      draft,
      brandVoiceExamples: await loadBrandVoice(),
      guidance: input.guidance,
    });
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Words too common to be worth treating as somebody's name. */
const STOP_WORDS = new Set([
  'what','when','where','who','why','how','did','does','do','the','and','for','about','with',
  'that','this','from','they','them','their','said','say','says','tell','told','was','were',
  'his','her','our','your','you','are','can','could','would','should','has','have','had','any',
  'all','get','got','me','my','it','is','on','in','of','to','at','a','an','last','ago','back',
]);

export interface ArchiveSource {
  /** The citation number used in the answer text — NOT a list position. */
  index: number;
  conversationId: string;
  conversationName: string;
  at: string;
  snippet: string;
}

export type AskResult =
  | { ok: true; answer: string; sources: ArchiveSource[] }
  | { ok: false; error: string };

/**
 * Answer a question from the whole message archive.
 *
 * Retrieval is Postgres full-text search over message bodies, ranked — the
 * same index the conversation search already uses, rather than a second search
 * path that could disagree with it. Contact names are matched separately with
 * trigram similarity, because "what did Sarah say about the deposit" carries
 * the person in the question and keyword search alone would miss every message
 * that never contains the word "Sarah".
 */
export async function askArchiveAction(question: string): Promise<AskResult> {
  const me = await requireUser();
  if (!(await isAiConfigured())) return { ok: false, error: 'AI is not configured.' };

  const q = question.trim();
  if (q.length < 3) return { ok: false, error: 'Ask a longer question.' };

  // Conversations belonging to a person named in the question.
  // Compared word by word, not against the whole sentence: trigram similarity
  // is length-normalised, so `displayName % 'what did sarah say about the
  // deposit'` never clears the threshold and this path silently never fired.
  const words = Array.from(
    new Set(
      q
        .toLowerCase()
        .split(/[^a-z']+/i)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
    ),
  ).slice(0, 8);

  const namedContacts = words.length
    ? await db
        .select({ id: contacts.id, name: contacts.displayName })
        .from(contacts)
        .where(
          sql.join(
            words.map((w) => sql`${contacts.displayName} ilike ${'%' + w + '%'}`),
            sql` or `,
          ),
        )
        .limit(5)
    : [];

  // Parameterized rather than interpolated. These ids come from our own table,
  // but building SQL by string concatenation is a habit worth not having.
  const nameFilter = namedContacts.length
    ? sql`or ${inArray(
        conversations.contactId,
        namedContacts.map((c) => c.id),
      )}`
    : sql``;

  // The search query: every content word of the question OR'd together,
  // plus the words the answer was probably texted in. websearch_to_tsquery on
  // the raw question ANDs every word, so "who asked about a refund this week"
  // only matched a message containing all of asked, refund and week.
  const expansions = await expandSearchQuery(q).catch(() => [] as string[]);
  const searchTerms = Array.from(new Set([...words, ...expansions.map((t) => t.toLowerCase())]))
    .map((t) => t.replace(/["\\]/g, '').trim())
    .filter(Boolean)
    .slice(0, 16);
  const tsq = searchTerms.map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' or ') || q;
  const rank = sql<number>`ts_rank(to_tsvector('english', coalesce(${messages.body}, '')), websearch_to_tsquery('english', ${tsq}))`;

  const select = {
    id: messages.id,
    conversationId: messages.conversationId,
    body: messages.body,
    createdAt: messages.createdAt,
    direction: messages.direction,
    title: conversations.title,
    isGroup: conversations.isGroup,
    chatGuid: conversations.providerChatGuid,
    contactName: contacts.displayName,
  };

  const lexical = await db
    .select({ ...select, rank })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .leftJoin(contacts, eq(contacts.id, conversations.contactId))
    .where(
      sql`(coalesce(${messages.body}, '') <> '' and ${messages.authorType} <> 'system' and (
        to_tsvector('english', coalesce(${messages.body}, '')) @@ websearch_to_tsquery('english', ${tsq})
        ${nameFilter}
      ))`,
    )
    // Relevance decayed by age (60-day e-folding, floored at 35%): between
    // two equally good matches the newer one wins, but a strong old match
    // still beats a weak new one. Plans, addresses and prices change; the
    // archive should surface what is true now first.
    .orderBy(
      desc(
        sql`${rank} * (0.35 + 0.65 * exp(-extract(epoch from (now() - ${messages.createdAt})) / 86400.0 / 60.0))`,
      ),
      desc(messages.createdAt),
    )
    .limit(40);

  // Matches by meaning, when an embeddings provider is configured: compare
  // the question with the most recent embedded messages. Lexical hits and
  // semantic hits are merged, best first, with the same recency decay.
  const decay = (d: Date) => 0.35 + 0.65 * Math.exp(-(Date.now() - d.getTime()) / 86_400_000 / 60);
  type Row = (typeof lexical)[number] & { score: number };
  const merged = new Map<string, Row>();
  const maxRank = Math.max(...lexical.map((r) => Number(r.rank) || 0), 1e-6);
  for (const r of lexical) {
    merged.set(r.id, { ...r, score: (Number(r.rank) / maxRank) * decay(r.createdAt) });
  }
  const emb = embeddingsConfig();
  if (emb) {
    try {
      const [qv] = await embedTexts([q], emb);
      const pool = await db
        .select({ ...select, v: messageEmbeddings.embedding })
        .from(messageEmbeddings)
        .innerJoin(messages, eq(messages.id, messageEmbeddings.messageId))
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .leftJoin(contacts, eq(contacts.id, conversations.contactId))
        .where(eq(messageEmbeddings.model, emb.model))
        .orderBy(desc(messageEmbeddings.createdAt))
        .limit(5000);
      for (const r of pool) {
        const sim = qv ? cosine(qv, r.v) : 0;
        if (sim < 0.35) continue;
        const score = sim * decay(r.createdAt);
        const prev = merged.get(r.id);
        if (!prev || prev.score < score) {
          const { v: _v, ...rest } = r;
          merged.set(r.id, { ...rest, rank: prev?.rank ?? 0, score });
        }
      }
    } catch {
      // Meaning-based search is a bonus; keyword results still stand.
    }
  }
  const rows = [...merged.values()].sort((x, y) => y.score - x.score).slice(0, 40);

  if (rows.length === 0) {
    return {
      ok: true,
      answer: "I couldn't find anything in your messages about that.",
      sources: [],
    };
  }

  const excerpts = rows.map((r) => ({
    conversationId: r.conversationId,
    conversationName: conversationName({
      contactName: r.contactName,
      title: r.title,
      isGroup: r.isGroup,
      chatGuid: r.chatGuid,
    }),
    at: r.createdAt.toISOString().slice(0, 10),
    direction: r.direction as 'inbound' | 'outbound',
    body: (r.body ?? '').slice(0, 600),
  }));

  const { answer, citedIndexes } = await answerFromArchive({
    question: q,
    excerpts,
    timeZone: await resolveTimeZone(me.id),
  });

  // Only the excerpts the model actually cited, KEYED BY THE NUMBER IT USED.
  // Renumbering from 1 made every [n] in the answer point at the wrong row,
  // which is worse than showing no sources at all — the whole promise of this
  // feature is that you can check it.
  const sources: ArchiveSource[] = citedIndexes
    .map((n) => {
      const e = excerpts[n - 1];
      return e
        ? {
            index: n,
            conversationId: e.conversationId,
            conversationName: e.conversationName,
            at: e.at,
            snippet: e.body.slice(0, 160),
          }
        : null;
    })
    .filter((s): s is ArchiveSource => s !== null);

  return { ok: true, answer, sources };
}

/**
 * Continue what the user is typing. Returns '' when there is nothing worth
 * suggesting, which is the common case and must stay cheap for the caller.
 */
export async function completeMessageAction(input: {
  conversationId: string;
  prefix: string;
}): Promise<{ completion: string }> {
  const me = await requireUser();
  if (!(await isAiConfigured())) return { completion: '' };

  const prefix = input.prefix;
  // Too little to go on, or already a finished thought.
  if (prefix.trim().length < 8) return { completion: '' };
  if (/[.!?]\s*$/.test(prefix)) return { completion: '' };

  // No embeddings call here: this runs on every pause in typing.
  const loaded = await loadTranscript(input.conversationId, me.id, { semantic: false });
  if (!loaded) return { completion: '' };

  try {
    const completion = await completeMessage({
      contactName: loaded.contactName,
      messages: loaded.transcript,
      context: loaded.context,
      prefix,
    });
    return { completion };
  } catch {
    // A failed completion must never surface as an error: the user is typing.
    return { completion: '' };
  }
}
