import type { Job } from 'bullmq';
import { type AiJob, publishEvent, logger } from '@comms/core';
import {
  isAiConfigured,
  triageConversation,
  summarizeConversation,
  suggestReply,
  assignBundles,
  type BundleCandidate,
  type TranscriptMessage,
  loadConversationForAi,
  contextTuning,
  splitSessions,
  summarizeSession,
  embeddingsConfig,
  embedTexts,
  getActiveProvider,
} from '@comms/ai';
import { getDb, eq, and, desc, inArray, isNull, sql } from '@comms/db';
import {
  conversations,
  messages,
  conversationTags,
  tagSuggestions,
  bundles,
  appSettings,
  conversationSessions,
  contactFacts,
  messageEmbeddings,
} from '@comms/db';
import { enqueueAiForConversation } from '@comms/core';
import {
  isTriageStale,
  modelMaySetPriority,
  shouldDraftReply,
  shouldTriage,
} from '../lib/ai-gating.js';

const log = logger.child({ module: 'ai' });

/**
 * The conversation as every AI feature sees it — transcript plus memory,
 * similarity, time zone and tuning. Shared with the web app; see
 * loadConversationForAi in @comms/ai. Background jobs have no acting user,
 * so "today" is the workspace's time zone.
 */
async function loadTranscript(conversationId: string) {
  const loaded = await loadConversationForAi(conversationId);
  return loaded ?? { transcript: [], contactName: null, contactId: null, context: {} };
}

/** Merge a patch into conversations.metadata.ai without clobbering siblings. */
async function mergeAiMetadata(conversationId: string, patch: Record<string, unknown>) {
  const db = getDb();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { metadata: true, inboxId: true },
  });
  if (!conv) return;
  const meta = (conv.metadata ?? {}) as Record<string, unknown>;
  const ai = (meta.ai ?? {}) as Record<string, unknown>;
  await db
    .update(conversations)
    .set({ metadata: { ...meta, ai: { ...ai, ...patch, at: new Date().toISOString() } } })
    .where(eq(conversations.id, conversationId));
  await publishEvent({ type: 'conversation.updated', conversationId, inboxId: conv.inboxId });
}

/**
 * Pre-compute the catch-up summary and next draft reply so both are waiting
 * before an agent opens the conversation — the difference between "click and
 * wait" and Tab-to-accept.
 *
 * Two model calls, so it is worth being sure the thread deserves them: see
 * `shouldDraftReply` for who does and does not.
 */
async function precompute(conversationId: string): Promise<void> {
  const db = getDb();

  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { kind: true, status: true, mutedAt: true },
  });
  if (!conv) return;

  const [latest] = await db
    .select({ direction: messages.direction })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  if (
    !shouldDraftReply({
      kind: conv.kind,
      status: conv.status,
      mutedAt: conv.mutedAt,
      lastDirection: latest?.direction ?? null,
    })
  ) {
    return;
  }

  const { transcript, contactName, context } = await loadTranscript(conversationId);
  if (transcript.length === 0) return;

  // Brand voice: recent real agent replies, so drafts sound like the team.
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
  const brandVoiceExamples = recent
    .map((m) => m.body?.trim())
    .filter((b): b is string => Boolean(b))
    .slice(0, 6);

  const [summary, draft] = await Promise.all([
    summarizeConversation({ contactName, messages: transcript, context }).catch((err) => {
      log.warn({ conversationId, err: (err as Error).message }, 'summary precompute failed');
      return null;
    }),
    suggestReply({ contactName, messages: transcript, brandVoiceExamples, context }).catch(
      (err) => {
        log.warn({ conversationId, err: (err as Error).message }, 'draft precompute failed');
        return null;
      },
    ),
  ]);

  const patch: Record<string, unknown> = {};
  if (summary) patch.summary = summary;
  if (draft) patch.draft = draft;
  if (Object.keys(patch).length === 0) return;

  await mergeAiMetadata(conversationId, patch);
  log.info({ conversationId, summary: Boolean(summary), draft: Boolean(draft) }, 'ai precomputed');
}

/**
 * Classify the conversation as it stands: priority, topic, sentiment, tags.
 *
 * Runs on new inbound activity, not only at creation. It used to fire exactly
 * once, on the first message a conversation ever received, which left every
 * thread permanently described by how it opened — a thread that began "quick
 * question about pricing" and turned into a two-month complaint still read
 * back as `sentiment: positive`, and no folder built on that field could tell.
 */
async function triage(conversationId: string): Promise<void> {
  const db = getDb();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (!conv) return;
  if (!shouldTriage(conv.kind)) return;

  const ai = ((conv.metadata ?? {}) as { ai?: Record<string, unknown> }).ai ?? {};
  const triagedAt = typeof ai.triagedAt === 'string' ? new Date(ai.triagedAt) : null;
  if (
    !isTriageStale({
      triagedAt: triagedAt && !Number.isNaN(triagedAt.getTime()) ? triagedAt : null,
      lastInboundAt: conv.lastInboundAt,
    })
  ) {
    return;
  }

  const { transcript, contactName, context } = await loadTranscript(conversationId);
  if (transcript.length === 0) return;

  let result;
  try {
    result = await triageConversation({ contactName, messages: transcript, context });
  } catch (err) {
    log.warn({ conversationId, err: (err as Error).message }, 'triage failed');
    return;
  }

  const modelChose = ai.priority;
  if (
    modelMaySetPriority({
      current: conv.priority,
      modelChose: typeof modelChose === 'string' ? (modelChose as typeof conv.priority) : null,
    }) &&
    result.priority !== conv.priority
  ) {
    await db
      .update(conversations)
      .set({ priority: result.priority })
      .where(eq(conversations.id, conv.id));
  }

  await mergeAiMetadata(conversationId, {
    summary: result.summary,
    topic: result.topic,
    sentiment: result.sentiment,
    suggestedTags: result.suggestedTags,
    // What the model chose, recorded whether or not it was applied — next time
    // it is how we tell our own value from one a human has since set.
    priority: result.priority,
    triagedAt: new Date().toISOString(),
  });

  // Apply suggested tags that already exist; queue the rest for admin approval
  // instead of silently dropping them. Tags are never auto-created.
  if (result.suggestedTags.length) {
    // `tagSuggestions.count` means "how many CONVERSATIONS wanted this tag",
    // which was safe to increment blindly while triage ran once per thread.
    // Now that it re-runs, a chatty conversation would vote for the same name
    // over and over and float it to the top of the admin's list on its own.
    const alreadySuggested = new Set(
      (Array.isArray(ai.suggestedTags) ? ai.suggestedTags : []).map((t) =>
        String(t).toLowerCase().trim(),
      ),
    );
    const allTags = await db.query.tags.findMany();
    const byName = new Map(allTags.map((t) => [t.name.toLowerCase(), t.id]));
    for (const rawName of result.suggestedTags) {
      const name = rawName.toLowerCase().trim();
      if (!name) continue;
      const tagId = byName.get(name);
      if (tagId) {
        // Re-applied every time on purpose: a tag an admin created since the
        // last run should land on the thread that asked for it.
        await db
          .insert(conversationTags)
          .values({ conversationId: conv.id, tagId })
          .onConflictDoNothing();
      } else if (!alreadySuggested.has(name)) {
        await db
          .insert(tagSuggestions)
          .values({ name, count: 1 })
          .onConflictDoUpdate({
            target: tagSuggestions.name,
            set: { count: sql`${tagSuggestions.count} + 1` },
          });
      }
    }
  }
}

/**
 * Bundle sweep: hand the model every active, un-bundled conversation and let
 * it group the ones that belong together. Only unassigned threads are
 * offered, so a manual "remove from bundle" or a dissolve sticks until the
 * thread itself changes; dissolved bundle names are passed as forbidden.
 */
async function bundleSweep(): Promise<void> {
  const db = getDb();

  const rows = await db.query.conversations.findMany({
    where: and(inArray(conversations.status, ['open', 'pending']), isNull(conversations.bundleId)),
    orderBy: [desc(conversations.lastMessageAt)],
    limit: 120,
    columns: { id: true, title: true, lastMessagePreview: true, metadata: true },
    with: { contact: { columns: { displayName: true } } },
  });
  if (rows.length < 3) return; // nothing worth grouping

  const existing = await db.query.bundles.findMany();
  const dismissedRow = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'bundles_dismissed'),
  });
  const forbidden = Array.isArray(dismissedRow?.value) ? (dismissedRow.value as string[]) : [];

  const candidates: BundleCandidate[] = rows.map((r) => ({
    conversationId: r.id,
    name: r.contact?.displayName ?? r.title ?? 'Unknown',
    topic: ((r.metadata as { ai?: { topic?: string } } | null)?.ai?.topic ?? null) || null,
    preview: r.lastMessagePreview,
  }));

  let assignments;
  try {
    assignments = await assignBundles({
      candidates,
      existingBundles: existing.map((b) => b.name),
      forbiddenNames: forbidden,
    });
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'bundle sweep failed');
    return;
  }

  const byName = new Map(existing.map((b) => [b.name.toLowerCase(), b.id]));
  let changed = 0;

  for (const a of assignments) {
    if (!a.bundle) continue;
    let bundleId = byName.get(a.bundle.toLowerCase());
    if (!bundleId) {
      const [created] = await db
        .insert(bundles)
        .values({ name: a.bundle })
        .onConflictDoUpdate({ target: bundles.name, set: { updatedAt: new Date() } })
        .returning({ id: bundles.id });
      if (!created) continue;
      bundleId = created.id;
      byName.set(a.bundle.toLowerCase(), bundleId);
    }
    await db
      .update(conversations)
      // Guard on "still unassigned": a human filing the thread mid-sweep wins.
      .set({ bundleId })
      .where(and(eq(conversations.id, a.conversationId), isNull(conversations.bundleId)));
    changed += 1;
  }

  // Bundles whose last member left dissolve on their own — an empty group
  // header in the list is clutter with a name.
  await db.execute(sql`
    delete from ${bundles} b
    where not exists (select 1 from ${conversations} c where c.bundle_id = b.id)
  `);

  if (changed > 0) {
    log.info({ assigned: changed }, 'bundle sweep applied');
    // One coarse refresh signal — per-conversation events would stampede SSE.
    const [first] = rows;
    if (first) {
      const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, first.id),
        columns: { id: true, inboxId: true },
      });
      if (conv) {
        await publishEvent({
          type: 'conversation.updated',
          conversationId: conv.id,
          inboxId: conv.inboxId,
        });
      }
    }
  }
}

// ---- Long-term memory --------------------------------------------------------

/** Sessions summarized per job. A backlog drains over successive sweeps. */
const MEMORY_SESSIONS_PER_JOB = 5;
/** Only the most recent sessions are worth summarizing on a first pass. */
const MEMORY_LOOKBACK_SESSIONS = 12;

/**
 * Summarize the finished sessions of one conversation and fold what they
 * reveal about the person into their facts.
 *
 * A session is finished once the thread has been quiet for the session gap.
 * Sessions are processed oldest first so a newer fact ("moved to Denver")
 * lands after, and replaces, an older one ("lives in Austin"). Facts are only
 * kept for one-to-one threads with a real person — in a group chat the model
 * cannot reliably tell whose fact is whose.
 */
async function memory(conversationId: string): Promise<void> {
  const db = getDb();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { id: true, contactId: true, isGroup: true, kind: true, metadata: true },
    with: { contact: { columns: { displayName: true } } },
  });
  if (!conv || conv.kind === 'automated' || conv.kind === 'otp') return;

  const { sessionGapMs } = await contextTuning();
  const rows = await db.query.messages.findMany({
    where: and(eq(messages.conversationId, conversationId), eq(messages.isRetracted, false)),
    orderBy: [desc(messages.createdAt)],
    limit: 400,
    with: { authorUser: { columns: { name: true } } },
  });
  const transcript: TranscriptMessage[] = rows
    .reverse()
    .filter((m) => m.authorType !== 'system' && (m.body ?? '').trim())
    .map((m) => ({
      id: m.id,
      role: m.authorType === 'contact' ? 'contact' : m.isPrivateNote ? 'note' : 'agent',
      author: m.authorUser?.name ?? null,
      text: m.body ?? '',
      at: m.createdAt,
    }));

  const now = Date.now();
  const finished = splitSessions(transcript, sessionGapMs)
    .filter((s) => s.start && s.end && now - s.end.getTime() >= sessionGapMs)
    .filter((s) => s.messages.length >= 2)
    .slice(-MEMORY_LOOKBACK_SESSIONS);

  const stored = await db.query.conversationSessions.findMany({
    where: eq(conversationSessions.conversationId, conversationId),
    columns: { startedAt: true },
  });
  const done = new Set(stored.map((s) => s.startedAt.getTime()));
  const pending = finished.filter((s) => !done.has(s.start!.getTime()));
  const batch = pending.slice(0, MEMORY_SESSIONS_PER_JOB);

  const keepFacts = Boolean(conv.contactId) && !conv.isGroup && conv.kind === 'person';
  const provider = await getActiveProvider().catch(() => null);

  for (const s of batch) {
    const known = keepFacts
      ? await db.query.contactFacts.findMany({ where: eq(contactFacts.contactId, conv.contactId!) })
      : [];
    let result;
    try {
      result = await summarizeSession({
        contactName: conv.contact?.displayName ?? null,
        messages: s.messages,
        knownFacts: known.map((f) => ({ key: f.key, value: f.value })),
        now: s.end!,
      });
    } catch (err) {
      log.warn({ conversationId, err: (err as Error).message }, 'session summary failed');
      return; // try again on the next sweep
    }
    if (!result.summary) continue;

    await db
      .insert(conversationSessions)
      .values({
        conversationId,
        startedAt: s.start!,
        endedAt: s.end!,
        messageCount: s.messages.length,
        summary: result.summary,
        model: provider?.model ?? null,
      })
      .onConflictDoUpdate({
        target: [conversationSessions.conversationId, conversationSessions.startedAt],
        set: { endedAt: s.end!, messageCount: s.messages.length, summary: result.summary },
      });

    if (!keepFacts) continue;
    const human = new Set(known.filter((f) => f.source === 'human').map((f) => f.key));
    const current = new Map(known.map((f) => [f.key, f.value.trim().toLowerCase()]));
    for (const f of result.facts) {
      // What a person typed into the card is never overwritten by the model.
      if (human.has(f.key)) continue;
      // A fact repeated unchanged keeps the date it was first learned, or an
      // old fact would look freshly confirmed every time the model echoed it.
      if (current.get(f.key) === f.value.trim().toLowerCase()) continue;
      await db
        .insert(contactFacts)
        .values({
          contactId: conv.contactId!,
          key: f.key,
          value: f.value,
          source: 'ai',
          sourceConversationId: conversationId,
          learnedAt: s.end!,
        })
        .onConflictDoUpdate({
          target: [contactFacts.contactId, contactFacts.key],
          set: { value: f.value, learnedAt: s.end!, sourceConversationId: conversationId },
          // Only replace an AI fact; a human one is left as the person set it.
          setWhere: eq(contactFacts.source, 'ai'),
        });
    }
    for (const key of result.forget) {
      if (human.has(key)) continue;
      await db
        .delete(contactFacts)
        .where(
          and(
            eq(contactFacts.contactId, conv.contactId!),
            eq(contactFacts.key, key),
            eq(contactFacts.source, 'ai'),
          ),
        );
    }
  }

  // Mark the thread as remembered only when nothing is left, so a backlog
  // keeps being picked up by the sweep until it is through.
  if (pending.length <= batch.length) {
    const meta = (conv.metadata ?? {}) as Record<string, unknown>;
    const ai = (meta.ai ?? {}) as Record<string, unknown>;
    await db
      .update(conversations)
      .set({ metadata: { ...meta, ai: { ...ai, memoryAt: new Date().toISOString() } } })
      .where(eq(conversations.id, conversationId));
  }
  if (batch.length) log.info({ conversationId, sessions: batch.length }, 'memory updated');
}

/**
 * Queue memory work for threads that have gone quiet since they were last
 * remembered. Cheap: one indexed query, at most 50 jobs, each collapsed per
 * conversation so a slow sweep can't stack duplicates.
 */
async function memorySweep(): Promise<void> {
  const db = getDb();
  const { sessionGapMs } = await contextTuning();
  const quietSince = new Date(Date.now() - sessionGapMs);
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        sql`${conversations.lastMessageAt} > now() - interval '180 days'`,
        sql`${conversations.lastMessageAt} < ${quietSince}`,
        sql`${conversations.kind} not in ('automated', 'otp')`,
        sql`(${conversations.metadata}->'ai'->>'memoryAt' is null
             or (${conversations.metadata}->'ai'->>'memoryAt')::timestamptz < ${conversations.lastMessageAt})`,
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(50);
  for (const r of rows) {
    await enqueueAiForConversation({ type: 'memory', conversationId: r.id }, { delayMs: 0 });
  }
  if (rows.length) log.info({ queued: rows.length }, 'memory sweep queued');
}

/**
 * Embed messages that have no vector yet, newest first, in batches. Runs only
 * when an embeddings provider is configured; without one this is a no-op and
 * recall stays keyword-based.
 */
async function embedSweep(): Promise<void> {
  const cfg = embeddingsConfig();
  if (!cfg) return;
  const db = getDb();
  const rows = await db
    .select({ id: messages.id, conversationId: messages.conversationId, body: messages.body })
    .from(messages)
    .leftJoin(
      messageEmbeddings,
      and(eq(messageEmbeddings.messageId, messages.id), eq(messageEmbeddings.model, cfg.model)),
    )
    .where(
      and(
        isNull(messageEmbeddings.messageId),
        sql`coalesce(${messages.body}, '') <> ''`,
        sql`${messages.authorType} <> 'system'`,
        eq(messages.isRetracted, false),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(256);
  for (let i = 0; i < rows.length; i += 64) {
    const chunk = rows.slice(i, i + 64);
    let vectors: number[][];
    try {
      vectors = await embedTexts(
        chunk.map((r) => r.body ?? ''),
        cfg,
      );
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'embedding batch failed');
      return;
    }
    await db
      .insert(messageEmbeddings)
      .values(
        chunk.map((r, j) => ({
          messageId: r.id,
          conversationId: r.conversationId,
          model: cfg.model,
          embedding: vectors[j]!,
        })),
      )
      // A message re-embedded under a new model replaces its old vector.
      .onConflictDoUpdate({
        target: messageEmbeddings.messageId,
        set: { model: cfg.model, embedding: sql`excluded.embedding`, createdAt: new Date() },
      });
  }
  if (rows.length) log.info({ embedded: rows.length }, 'embedded messages');
}

export async function processAiJob(job: Job<AiJob>): Promise<void> {
  // Embeddings use their own provider, so they run whether or not a chat
  // model is configured.
  if (job.data.type === 'embed') return embedSweep();
  if (!(await isAiConfigured())) return;
  switch (job.data.type) {
    case 'triage':
      return triage(job.data.conversationId);
    case 'precompute':
      return precompute(job.data.conversationId);
    case 'bundle':
      return bundleSweep();
    case 'memory':
      return memory(job.data.conversationId);
    case 'memorySweep':
      return memorySweep();
  }
}
