'use server';

import { and, eq, ilike, or } from '@comms/db';
import { conversations, contacts, contactIdentities } from '@comms/db';
import { db } from '@/server/db';
import { requireUser, requireWriter } from '@/lib/session';
import { formatAddress } from '@/lib/naming';
import { startConversationAs, type StartResult } from '@/server/start-conversation';

export type { StartResult } from '@/server/start-conversation';

export interface RecipientSuggestion {
  contactId: string | null;
  name: string;
  address: string;
  /** True when we already have a conversation with them. */
  hasConversation: boolean;
  conversationId: string | null;
}

/**
 * Type-ahead over known contacts and their addresses. Falls back to treating
 * the raw input as an address so you can always message someone new.
 */
export async function searchRecipients(term: string): Promise<RecipientSuggestion[]> {
  await requireUser();
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const rows = await db
    .select({
      contactId: contacts.id,
      name: contacts.displayName,
      address: contactIdentities.value,
      rawValue: contactIdentities.rawValue,
    })
    .from(contactIdentities)
    .innerJoin(contacts, eq(contacts.id, contactIdentities.contactId))
    .where(
      or(
        ilike(contacts.displayName, like),
        ilike(contactIdentities.value, like),
        ilike(contactIdentities.rawValue, like),
      ),
    )
    .limit(20);

  const suggestions: RecipientSuggestion[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    if (seen.has(r.address)) continue;
    seen.add(r.address);

    const existing = await db.query.conversations.findFirst({
      where: eq(conversations.contactId, r.contactId),
      columns: { id: true },
    });

    const address = r.rawValue || r.address;
    suggestions.push({
      contactId: r.contactId,
      // `||` so an unnamed contact falls through to its number rather than
      // showing a blank row, and the number is formatted the way the inbox
      // formats it.
      name: r.name || formatAddress(address) || address,
      address,
      hasConversation: Boolean(existing),
      conversationId: existing?.id ?? null,
    });
  }

  // Always allow messaging a raw address that isn't in the address book.
  const looksLikeAddress = /^[+\d()\-.\s]{7,}$/.test(q) || q.includes('@');
  if (looksLikeAddress && !suggestions.some((s) => s.address.replace(/\D/g, '') === q.replace(/\D/g, ''))) {
    suggestions.unshift({
      contactId: null,
      name: q,
      address: q,
      hasConversation: false,
      conversationId: null,
    });
  }

  return suggestions.slice(0, 8);
}

/**
 * Start a conversation with an address, sending the first message. If there
 * is already a thread with that person, hands it back instead.
 */
export async function startConversation(input: {
  address: string;
  message: string;
  inboxId?: string;
}): Promise<StartResult> {
  const user = await requireWriter();
  return startConversationAs(user, input);
}
