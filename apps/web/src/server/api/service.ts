import 'server-only';
import {
  and,
  desc,
  eq,
  sql,
  contacts,
  conversations,
  messages,
  users,
  findContactViews,
  getConversationView,
  listContactFacts,
  listConversationViews,
  listMessageViews,
  loadContactViews,
  type ContactView,
  type ConversationView,
  type MessageView,
} from '@comms/db';
import { loadConfig } from '@comms/core';
import { db } from '@/server/db';
import { sendAs, updateConversationAs } from '@/server/send';
import { startConversationAs } from '@/server/start-conversation';
import { ApiError, requireScope, type ApiPrincipal } from './tokens';

/**
 * Everything an API key can do, in one place. The REST routes and the MCP
 * tools are thin adapters over these functions, so the two can't drift.
 *
 * Every function takes the principal: reads act as the key's owner, writes
 * additionally need the key's `write` scope and go through the same code the
 * inbox uses (signature, opt-out check, undo window, timeline events).
 */

const appUrl = () => loadConfig().appUrl;

export function whoAmI(p: ApiPrincipal) {
  return {
    user: { id: p.user.id, name: p.user.name, email: p.user.email },
    scopes: p.scopes,
    workspaceUrl: appUrl(),
  };
}

export async function listConversations(
  p: ApiPrincipal,
  q: {
    status?: ConversationView['status'] | 'all';
    assigned?: 'me' | 'unassigned' | 'any';
    contactId?: string;
    before?: string;
    limit?: number;
  },
): Promise<ConversationView[]> {
  return listConversationViews(
    {
      status: q.status ?? 'open',
      assigneeId: q.assigned === 'me' ? p.user.id : q.assigned === 'unassigned' ? null : undefined,
      contactId: q.contactId,
      before: q.before,
      limit: q.limit,
    },
    appUrl(),
  );
}

export interface SearchResult {
  conversation: ConversationView;
  /** The best-matching message, when the match was in a message body. */
  match: { messageId: string; body: string; at: string } | null;
}

/**
 * Full-text search over message bodies (Postgres websearch syntax: quoted
 * phrases, OR, -exclusions), plus contact names and conversation titles.
 * Internal notes are not searched — they are for the team, not for tools.
 */
export async function searchConversations(
  _p: ApiPrincipal,
  query: string,
  limit = 10,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cap = Math.min(Math.max(limit, 1), 25);

  const hits = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      body: messages.body,
      at: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.isPrivateNote, false),
        sql`to_tsvector('english', coalesce(${messages.body}, '')) @@ websearch_to_tsquery('english', ${q})`,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(200);

  const byConversation = new Map<string, SearchResult['match']>();
  for (const h of hits) {
    if (!byConversation.has(h.conversationId)) {
      byConversation.set(h.conversationId, {
        messageId: h.id,
        body: (h.body ?? '').slice(0, 500),
        at: h.at.toISOString(),
      });
    }
  }

  const named = await db
    .select({ id: conversations.id })
    .from(conversations)
    .leftJoin(contacts, eq(contacts.id, conversations.contactId))
    .where(
      sql`${conversations.title} ILIKE ${'%' + q + '%'} OR ${contacts.displayName} ILIKE ${'%' + q + '%'}`,
    )
    .orderBy(sql`${conversations.lastMessageAt} desc nulls last`)
    .limit(cap);

  const ids = [...new Set([...named.map((n) => n.id), ...byConversation.keys()])].slice(0, cap * 2);
  const views = await listConversationViews({ ids, status: 'all', limit: cap * 2 }, appUrl());
  return views
    .map((conversation) => ({ conversation, match: byConversation.get(conversation.id) ?? null }))
    .sort((a, b) =>
      (b.match?.at ?? b.conversation.lastMessageAt ?? '').localeCompare(
        a.match?.at ?? a.conversation.lastMessageAt ?? '',
      ),
    )
    .slice(0, cap);
}

export async function getConversation(
  _p: ApiPrincipal,
  id: string,
  opts: { messageLimit?: number; before?: string; includeNotes?: boolean } = {},
): Promise<{
  conversation: ConversationView;
  messages: MessageView[];
  facts: Awaited<ReturnType<typeof listContactFacts>>;
}> {
  const conversation = await getConversationView(id, appUrl());
  if (!conversation) throw new ApiError(404, 'Conversation not found.');
  const [msgs, facts] = await Promise.all([
    listMessageViews(id, {
      limit: opts.messageLimit ?? 30,
      before: opts.before,
      includeNotes: opts.includeNotes,
    }),
    conversation.contact && !conversation.isGroup
      ? listContactFacts(conversation.contact.id)
      : Promise.resolve([]),
  ]);
  return { conversation, messages: msgs, facts };
}

export async function findContacts(
  _p: ApiPrincipal,
  q: { query?: string; phone?: string; email?: string; limit?: number },
): Promise<ContactView[]> {
  // A free-text query is routed by what it looks like.
  const query = q.query?.trim();
  const looksLikePhone = query && /^[+(\d][\d\s().-]{5,}$/.test(query);
  const looksLikeEmail = query?.includes('@');
  return findContactViews({
    phone: q.phone ?? (looksLikePhone ? query : undefined),
    email: q.email ?? (looksLikeEmail ? query : undefined),
    name: !looksLikePhone && !looksLikeEmail ? query : undefined,
    limit: q.limit,
  });
}

export async function getContact(p: ApiPrincipal, id: string) {
  const contact = (await loadContactViews([id])).get(id);
  if (!contact) throw new ApiError(404, 'Contact not found.');
  const [facts, threads] = await Promise.all([
    listContactFacts(id),
    listConversations(p, { contactId: id, status: 'all', assigned: 'any', limit: 10 }),
  ]);
  return { contact, facts, conversations: threads };
}

/**
 * Send a reply. It is queued exactly like one typed in the inbox — signed,
 * opt-out checked — and goes out after the workspace's undo window, so a
 * teammate watching the thread can still stop it.
 */
async function assertVisible(conversationId: string) {
  if (!(await getConversationView(conversationId, appUrl()))) {
    throw new ApiError(404, 'Conversation not found.');
  }
}

export async function sendReply(p: ApiPrincipal, conversationId: string, body: string) {
  requireScope(p, 'write');
  await assertVisible(conversationId);
  const res = await sendAs(p.user, { conversationId, body });
  if (!res.ok) throw new ApiError(res.error === 'Conversation not found.' ? 404 : 422, res.error);
  const message = (await listMessageViews(conversationId, { limit: 1 }))[0] ?? null;
  return {
    messageId: res.messageId,
    status: 'queued' as const,
    undoSeconds: res.undoMs / 1000,
    message,
  };
}

export async function addNote(p: ApiPrincipal, conversationId: string, body: string) {
  requireScope(p, 'write');
  await assertVisible(conversationId);
  const res = await sendAs(p.user, { conversationId, body, isPrivateNote: true });
  if (!res.ok) throw new ApiError(res.error === 'Conversation not found.' ? 404 : 422, res.error);
  return { messageId: res.messageId };
}

/**
 * Message someone by phone number or email. If there is already a thread with
 * them the message goes there (through the normal send path, with its undo
 * window); otherwise a new iMessage chat is opened.
 */
export async function startConversation(p: ApiPrincipal, input: { address: string; body: string }) {
  requireScope(p, 'write');
  const res = await startConversationAs(p.user, { address: input.address, message: input.body });
  if (!res.ok) throw new ApiError(422, res.error);
  if (res.existing) {
    const sent = await sendReply(p, res.conversationId, input.body);
    return { conversationId: res.conversationId, existing: true, ...sent };
  }
  return { conversationId: res.conversationId, existing: false, status: 'sent' as const };
}

export async function updateConversation(
  p: ApiPrincipal,
  id: string,
  patch: {
    status?: ConversationView['status'];
    priority?: ConversationView['priority'];
    /** Email of the teammate to assign; empty string or null unassigns. */
    assigneeEmail?: string | null;
  },
) {
  requireScope(p, 'write');
  if (!(await getConversationView(id, appUrl())))
    throw new ApiError(404, 'Conversation not found.');
  let assigneeId: string | null | undefined;
  if (patch.assigneeEmail !== undefined) {
    if (!patch.assigneeEmail) assigneeId = null;
    else {
      const u = await db.query.users.findFirst({
        where: and(
          eq(users.email, patch.assigneeEmail.trim().toLowerCase()),
          eq(users.status, 'active'),
        ),
        columns: { id: true },
      });
      if (!u) throw new ApiError(422, `No active teammate with the email ${patch.assigneeEmail}.`);
      assigneeId = u.id;
    }
  }
  const res = await updateConversationAs(p.user, {
    id,
    status: patch.status,
    priority: patch.priority,
    assigneeId,
  });
  if (!res.ok) throw new ApiError(422, res.error);
  return getConversationView(id, appUrl());
}

export async function listTeammates(_p: ApiPrincipal) {
  const rows = await db.query.users.findMany({
    where: eq(users.status, 'active'),
    columns: { id: true, name: true, email: true },
  });
  return rows;
}
