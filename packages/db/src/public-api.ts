import { and, asc, desc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { getDb } from './client.js';
import {
  contactFacts,
  contactIdentities,
  contacts,
  conversations,
  messages,
} from './schema/index.js';

/**
 * The shapes Comms shows to the outside world — the REST API, the MCP server
 * and outbound webhooks all hand out exactly these, so an integration sees
 * one consistent model whichever door it came in through.
 *
 * Deliberately smaller than the tables: provider guids, SLA internals and
 * avatar bytes stay inside.
 */

export interface ContactView {
  id: string;
  name: string | null;
  company: string | null;
  phones: string[];
  emails: string[];
  /** Replied STOP: Comms will refuse to message them until they reply START. */
  optedOut: boolean;
}

export interface ConversationView {
  id: string;
  number: number;
  title: string;
  status: 'open' | 'pending' | 'snoozed' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  isGroup: boolean;
  channel: string;
  assignee: { id: string; name: string | null; email: string } | null;
  contact: ContactView | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  /** Link to the conversation in the Comms app. */
  url: string;
}

export interface MessageView {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  /** `note` is an internal note: never sent, visible only to the team. */
  kind: 'message' | 'note';
  body: string;
  author: { type: 'contact' | 'agent' | 'system' | 'external'; name: string | null };
  status: string;
  createdAt: string;
  sentAt: string | null;
}

/**
 * Verification-code threads never leave Comms through an integration: a code
 * read by an outside AI or written into a CRM is a code someone else can use.
 */
export const HIDDEN_KINDS = ['otp'] as const;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function loadContactViews(ids: string[]): Promise<Map<string, ContactView>> {
  const out = new Map<string, ContactView>();
  if (ids.length === 0) return out;
  const db = getDb();
  const rows = await db.query.contacts.findMany({
    where: inArray(contacts.id, ids),
    columns: { id: true, displayName: true, company: true, optedOutAt: true },
    with: { identities: { columns: { kind: true, value: true } } },
  });
  for (const c of rows) {
    out.set(c.id, {
      id: c.id,
      name: c.displayName,
      company: c.company,
      phones: c.identities.filter((i) => i.kind === 'phone').map((i) => i.value),
      emails: c.identities.filter((i) => i.kind === 'email').map((i) => i.value),
      optedOut: Boolean(c.optedOutAt),
    });
  }
  return out;
}

type ConversationRow = typeof conversations.$inferSelect & {
  assignee: { id: string; name: string | null; email: string } | null;
};

async function toConversationViews(
  rows: ConversationRow[],
  appUrl: string,
): Promise<ConversationView[]> {
  const contactMap = await loadContactViews(
    rows.map((r) => r.contactId).filter((x): x is string => Boolean(x)),
  );
  return rows.map((r) => {
    const contact = r.contactId ? (contactMap.get(r.contactId) ?? null) : null;
    return {
      id: r.id,
      number: r.number,
      title: r.title || contact?.name || contact?.phones[0] || contact?.emails[0] || `#${r.number}`,
      status: r.status,
      priority: r.priority,
      isGroup: r.isGroup,
      channel: r.channelType,
      assignee: r.assignee,
      contact,
      lastMessageAt: iso(r.lastMessageAt),
      lastMessagePreview: r.lastMessagePreview,
      unreadCount: r.unreadCount,
      url: `${appUrl}/inbox/${r.id}`,
    };
  });
}

const ASSIGNEE = { assignee: { columns: { id: true, name: true, email: true } } } as const;

export async function getConversationView(
  id: string,
  appUrl: string,
): Promise<ConversationView | null> {
  const row = await getDb().query.conversations.findFirst({
    where: and(eq(conversations.id, id), sql`${conversations.kind} <> 'otp'`),
    with: ASSIGNEE,
  });
  if (!row) return null;
  return (await toConversationViews([row], appUrl))[0] ?? null;
}

export interface ListConversationsOptions {
  status?: ConversationView['status'] | 'all';
  assigneeId?: string | null;
  contactId?: string;
  ids?: string[];
  /** ISO timestamp: only threads whose last message is older (for paging). */
  before?: string;
  limit?: number;
}

export async function listConversationViews(
  opts: ListConversationsOptions,
  appUrl: string,
): Promise<ConversationView[]> {
  const conds = [sql`${conversations.kind} <> 'otp'`];
  if (opts.status && opts.status !== 'all') conds.push(eq(conversations.status, opts.status));
  if (opts.assigneeId === null) conds.push(isNull(conversations.assigneeId));
  else if (opts.assigneeId) conds.push(eq(conversations.assigneeId, opts.assigneeId));
  if (opts.contactId) conds.push(eq(conversations.contactId, opts.contactId));
  if (opts.ids) {
    if (opts.ids.length === 0) return [];
    conds.push(inArray(conversations.id, opts.ids));
  }
  if (opts.before) conds.push(lt(conversations.lastMessageAt, new Date(opts.before)));
  const rows = await getDb().query.conversations.findMany({
    where: and(...conds),
    orderBy: [sql`${conversations.lastMessageAt} desc nulls last`],
    limit: Math.min(Math.max(opts.limit ?? 20, 1), 100),
    with: ASSIGNEE,
  });
  return toConversationViews(rows, appUrl);
}

type MessageRow = typeof messages.$inferSelect & {
  authorUser: { name: string | null } | null;
  authorContact: { displayName: string | null } | null;
};

function toMessageView(m: MessageRow): MessageView {
  return {
    id: m.id,
    conversationId: m.conversationId,
    direction: m.direction,
    kind: m.isPrivateNote ? 'note' : 'message',
    body: m.body ?? '',
    author: {
      type: m.authorType,
      name:
        m.authorType === 'contact'
          ? (m.authorContact?.displayName ?? null)
          : (m.authorUser?.name ?? null),
    },
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    sentAt: iso(m.sentAt),
  };
}

const AUTHORS = {
  authorUser: { columns: { name: true } },
  authorContact: { columns: { displayName: true } },
} as const;

/**
 * Messages in a conversation, newest `limit`, returned oldest first. Reactions
 * and retracted messages are left out; notes are included only when asked.
 */
export async function listMessageViews(
  conversationId: string,
  opts: { limit?: number; before?: string; includeNotes?: boolean } = {},
): Promise<MessageView[]> {
  const conds = [
    eq(messages.conversationId, conversationId),
    eq(messages.isRetracted, false),
    isNull(messages.reactionType),
    ne(messages.authorType, 'system'),
  ];
  if (!opts.includeNotes) conds.push(eq(messages.isPrivateNote, false));
  if (opts.before) conds.push(lt(messages.createdAt, new Date(opts.before)));
  const rows = await getDb().query.messages.findMany({
    where: and(...conds),
    orderBy: [desc(messages.createdAt)],
    limit: Math.min(Math.max(opts.limit ?? 30, 1), 200),
    with: AUTHORS,
  });
  return rows.reverse().map(toMessageView);
}

export async function getMessageView(id: string): Promise<MessageView | null> {
  const row = await getDb().query.messages.findFirst({
    where: eq(messages.id, id),
    with: AUTHORS,
  });
  return row ? toMessageView(row) : null;
}

/**
 * Find contacts by phone number, email, or name. Phones match on their last
 * ten digits, the same rule the inbox uses to join an address-book number
 * (national format) to an iMessage handle (E.164).
 */
export async function findContactViews(q: {
  phone?: string;
  email?: string;
  name?: string;
  limit?: number;
}): Promise<ContactView[]> {
  const db = getDb();
  const ids = new Set<string>();
  const limit = Math.min(Math.max(q.limit ?? 10, 1), 50);
  if (q.phone) {
    const digits = q.phone.replace(/\D/g, '');
    if (digits.length >= 7) {
      const key = digits.slice(-10);
      const rows = await db
        .select({ id: contactIdentities.contactId })
        .from(contactIdentities)
        .where(
          and(
            eq(contactIdentities.kind, 'phone'),
            sql`right(regexp_replace(${contactIdentities.value}, '\\D', '', 'g'), 10) = ${key}`,
          ),
        )
        .limit(limit);
      rows.forEach((r) => ids.add(r.id));
    }
  }
  if (q.email) {
    const rows = await db
      .select({ id: contactIdentities.contactId })
      .from(contactIdentities)
      .where(
        and(
          eq(contactIdentities.kind, 'email'),
          eq(contactIdentities.value, q.email.trim().toLowerCase()),
        ),
      )
      .limit(limit);
    rows.forEach((r) => ids.add(r.id));
  }
  if (q.name?.trim()) {
    const term = q.name.trim();
    const rows = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(sql`${contacts.displayName} ILIKE ${'%' + term + '%'}`)
      .orderBy(asc(contacts.displayName))
      .limit(limit);
    rows.forEach((r) => ids.add(r.id));
  }
  const map = await loadContactViews([...ids].slice(0, limit));
  return [...map.values()];
}

/** What the AI has learned about a contact, for integrations that want it. */
export async function listContactFacts(
  contactId: string,
): Promise<{ key: string; value: string; learnedAt: string; source: string }[]> {
  const rows = await getDb().query.contactFacts.findMany({
    where: eq(contactFacts.contactId, contactId),
  });
  return rows
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((f) => ({
      key: f.key,
      value: f.value,
      learnedAt: f.learnedAt.toISOString(),
      source: f.source,
    }));
}
