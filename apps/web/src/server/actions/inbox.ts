'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, inArray } from '@comms/db';
import {
  conversations,
  messages,
  conversationTags,
} from '@comms/db';
import { outboundQueue, publishEvent } from '@comms/core';
import { desc } from '@comms/db';
import { db } from '@/server/db';
import { requireUser, requireWriter } from '@/lib/session';
import { unpinClosedFor } from '@/server/actions/pins';
import {
  sendAs,
  updateConversationAs,
  type ConversationPatch,
  type SendInput,
  type SendResult,
} from '@/server/send';

export type ActionResult = { ok: true } | { ok: false; error: string };

export type { SendResult } from '@/server/send';

/** Send a reply (queued for the worker) or save an internal note. */
export async function sendMessage(input: SendInput): Promise<SendResult> {
  const user = await requireWriter();
  return sendAs(user, input);
}

/** Cancel a scheduled reply before it fires. Same mechanism as undo-send. */
export async function cancelScheduled(messageId: string): Promise<ActionResult> {
  return undoSend(messageId);
}

/**
 * Retract a reply that is still inside its undo window. Removes the delayed
 * BullMQ job (by jobId = messageId) and deletes the message row. Fails cleanly
 * if the worker already picked the job up.
 */
export async function undoSend(messageId: string): Promise<ActionResult> {
  const user = await requireWriter();

  const msg = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
  if (!msg) return { ok: false, error: 'Message not found.' };
  if (msg.authorUserId !== user.id) return { ok: false, error: 'Only the sender can undo.' };
  if (msg.status !== 'queued') return { ok: false, error: 'Too late — already sent.' };

  const removed = await outboundQueue()
    .remove(messageId)
    .catch(() => 0);
  if (!removed) {
    // The worker grabbed it between our check and the remove.
    return { ok: false, error: 'Too late — already sending.' };
  }

  await db.delete(messages).where(eq(messages.id, messageId));

  // Roll the conversation preview back to the latest remaining message.
  const latest = await db.query.messages.findFirst({
    where: eq(messages.conversationId, msg.conversationId),
    orderBy: [desc(messages.createdAt)],
  });
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, msg.conversationId),
    columns: { id: true, inboxId: true },
  });
  await db
    .update(conversations)
    .set({
      lastMessageAt: latest?.sentAt ?? latest?.createdAt ?? null,
      lastMessagePreview: latest?.body?.slice(0, 280) ?? '',
    })
    .where(eq(conversations.id, msg.conversationId));

  if (conv) {
    await publishEvent({
      type: 'conversation.updated',
      conversationId: conv.id,
      inboxId: conv.inboxId,
    });
  }
  revalidatePath(`/inbox/${msg.conversationId}`);
  return { ok: true };
}

/** Update ticket attributes (status, priority, assignee) and log a timeline event. */
export async function updateConversation(input: ConversationPatch): Promise<ActionResult> {
  const user = await requireWriter();
  return updateConversationAs(user, input);
}

export async function toggleTag(conversationId: string, tagId: string): Promise<ActionResult> {
  await requireWriter();
  const existing = await db.query.conversationTags.findFirst({
    where: and(
      eq(conversationTags.conversationId, conversationId),
      eq(conversationTags.tagId, tagId),
    ),
  });
  if (existing) {
    await db
      .delete(conversationTags)
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          eq(conversationTags.tagId, tagId),
        ),
      );
  } else {
    await db.insert(conversationTags).values({ conversationId, tagId }).onConflictDoNothing();
  }
  revalidatePath(`/inbox/${conversationId}`);
  return { ok: true };
}

/** Apply a status/assignee change to many conversations at once. */
export async function bulkUpdateConversations(
  ids: string[],
  patch: { status?: 'open' | 'pending' | 'closed'; assigneeId?: string | null },
): Promise<ActionResult> {
  await requireWriter();
  if (ids.length === 0) return { ok: true };

  const set: Partial<typeof conversations.$inferInsert> = {};
  if (patch.status) {
    set.status = patch.status;
    if (patch.status === 'closed') set.closedAt = new Date();
    if (patch.status !== 'open') set.nextResponseDueAt = null;
  }
  if (patch.assigneeId !== undefined) set.assigneeId = patch.assigneeId;
  if (Object.keys(set).length === 0) return { ok: true };

  await db.update(conversations).set(set).where(inArray(conversations.id, ids));
  if (patch.status === 'closed') await unpinClosedFor(ids);
  revalidatePath('/inbox');
  return { ok: true };
}

/**
 * Arm a follow-up reminder: "bump this back to me at T if the customer hasn't
 * replied." Passing null cancels it. Distinct from snooze — see the worker's
 * followUps sweep.
 */
export async function setFollowUp(
  conversationId: string,
  at: string | null,
): Promise<ActionResult> {
  const user = await requireWriter();
  await db
    .update(conversations)
    .set({
      followUpAt: at ? new Date(at) : null,
      followUpArmedAt: at ? new Date() : null,
      followUpUserId: at ? user.id : null,
    })
    .where(eq(conversations.id, conversationId));
  revalidatePath(`/inbox/${conversationId}`);
  return { ok: true };
}

/** Mark a conversation read (clears the unread badge in Comms). */
export async function markRead(conversationId: string): Promise<ActionResult> {
  await requireWriter();
  await db
    .update(conversations)
    .set({ unreadCount: 0 })
    .where(eq(conversations.id, conversationId));
  return { ok: true };
}

/**
 * Mute or unmute a conversation. A muted thread stays exactly where it is and
 * keeps receiving messages — it just stops counting as unread and stops
 * making noise. Permanent until unmuted, which is the difference from snooze.
 */
export async function setMuted(conversationId: string, muted: boolean): Promise<ActionResult> {
  await requireWriter();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { id: true, inboxId: true },
  });
  if (!conv) return { ok: false, error: 'Conversation not found.' };

  await db
    .update(conversations)
    .set({
      mutedAt: muted ? new Date() : null,
      // Muting also silences what already piled up — that pile is why you
      // reached for the button.
      ...(muted ? { unreadCount: 0 } : {}),
    })
    .where(eq(conversations.id, conversationId));

  await publishEvent({ type: 'conversation.updated', conversationId, inboxId: conv.inboxId });
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${conversationId}`);
  return { ok: true };
}

/**
 * Dismiss a nudge ("you said you'd send this…"). Remembered per promise: the
 * same message never nudges twice, but a NEW promise in a later reply can.
 */
export async function dismissNudge(conversationId: string): Promise<ActionResult> {
  await requireWriter();
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { id: true, inboxId: true, metadata: true },
  });
  if (!conv) return { ok: false, error: 'Conversation not found.' };

  const meta = (conv.metadata ?? {}) as Record<string, unknown>;
  const nudge = meta.nudge as Record<string, unknown> | undefined;
  if (!nudge) return { ok: true };

  await db
    .update(conversations)
    .set({ metadata: { ...meta, nudge: { ...nudge, dismissedAt: new Date().toISOString() } } })
    .where(eq(conversations.id, conversationId));

  await publishEvent({ type: 'conversation.updated', conversationId, inboxId: conv.inboxId });
  revalidatePath(`/inbox/${conversationId}`);
  return { ok: true };
}
