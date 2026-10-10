import 'server-only';
import { revalidatePath } from 'next/cache';
import { and, eq } from '@comms/db';
import { conversations, messages, contacts, contactIdentities, inboxes } from '@comms/db';
import {
  BlueBubblesClient,
  decryptSecret,
  loadConfig,
  normalizeAddress,
  addressMatchKey,
  newTempGuid,
  describeConnectionError,
  publishEvent,
  logger,
} from '@comms/core';
import { db } from '@/server/db';
import { getConnectionForInbox } from '@/server/queries';

const log = logger.child({ action: 'new-conversation' });

export type StartResult =
  | { ok: true; conversationId: string; existing: boolean }
  | { ok: false; error: string };

/**
 * Start a conversation with an address, sending the first message.
 *
 * If we already have a conversation with that person we hand back the existing
 * one rather than creating a duplicate — sending to someone you've already
 * spoken to should land in the same thread.
 */
export async function startConversationAs(
  user: { id: string },
  input: { address: string; message: string; inboxId?: string },
): Promise<StartResult> {
  const address = input.address.trim();
  const body = input.message.trim();
  if (!address) return { ok: false, error: 'Who do you want to message?' };
  if (!body) return { ok: false, error: 'Write a message first.' };

  const inbox = input.inboxId
    ? await db.query.inboxes.findFirst({ where: eq(inboxes.id, input.inboxId) })
    : await db.query.inboxes.findFirst({ orderBy: (i, { desc }) => [desc(i.isDefault)] });
  if (!inbox) return { ok: false, error: 'No inbox is set up yet.' };

  const connection = await getConnectionForInbox(inbox.id);
  if (!connection) return { ok: false, error: 'This inbox has no connected channel.' };

  // Already talking to them? Reuse the thread.
  const norm = normalizeAddress(address);
  const key = addressMatchKey(norm);
  const identities = await db
    .select({
      contactId: contactIdentities.contactId,
      value: contactIdentities.value,
      kind: contactIdentities.kind,
    })
    .from(contactIdentities);
  const match = identities.find(
    (i) => addressMatchKey({ kind: i.kind, value: i.value, raw: i.value }) === key,
  );

  if (match) {
    const existing = await db.query.conversations.findFirst({
      where: and(eq(conversations.contactId, match.contactId), eq(conversations.inboxId, inbox.id)),
    });
    if (existing) return { ok: true, conversationId: existing.id, existing: true };
  }

  // Ask BlueBubbles to open the chat and send the first message.
  const client = new BlueBubblesClient({
    serverUrl: connection.serverUrl,
    password: decryptSecret(connection.credentialsEncrypted, loadConfig().appSecret),
  });
  const tempGuid = newTempGuid();

  let chatGuid: string;
  try {
    const chat = await client.createChat({
      addresses: [norm.value],
      message: body,
      method: connection.capabilities?.privateApi ? 'private-api' : 'apple-script',
      tempGuid,
    });
    chatGuid = chat?.guid;
    if (!chatGuid) throw new Error('BlueBubbles did not return a chat id');
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'createChat failed');
    return { ok: false, error: describeConnectionError(err, connection.serverUrl) };
  }

  // Persist locally. The webhook echo will reconcile the message by tempGuid.
  let contactId = match?.contactId ?? null;
  if (!contactId) {
    const [created] = await db
      .insert(contacts)
      .values({ displayName: norm.raw })
      .returning({ id: contacts.id });
    contactId = created?.id ?? null;
    if (contactId) {
      await db
        .insert(contactIdentities)
        .values({ contactId, kind: norm.kind, value: norm.value, rawValue: norm.raw })
        .onConflictDoNothing();
    }
  }

  const [conv] = await db
    .insert(conversations)
    .values({
      inboxId: inbox.id,
      providerChatGuid: chatGuid,
      contactId,
      isGroup: false,
      status: 'open',
      assigneeId: user.id,
      lastMessageAt: new Date(),
      lastMessagePreview: body.slice(0, 280),
    })
    .onConflictDoNothing()
    .returning();

  const conversation =
    conv ??
    (await db.query.conversations.findFirst({
      where: and(eq(conversations.inboxId, inbox.id), eq(conversations.providerChatGuid, chatGuid)),
    }));
  if (!conversation) return { ok: false, error: 'Could not save the conversation.' };

  await db.insert(messages).values({
    conversationId: conversation.id,
    direction: 'outbound',
    authorType: 'agent',
    authorUserId: user.id,
    body,
    status: 'sent',
    sentAt: new Date(),
    tempGuid,
  });

  await publishEvent({
    type: 'conversation.created',
    conversationId: conversation.id,
    inboxId: inbox.id,
  });
  revalidatePath('/inbox');
  return { ok: true, conversationId: conversation.id, existing: false };
}
