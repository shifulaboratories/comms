import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { FN_SEND_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { comms, CommsApiError, CommsNotConfiguredError } from 'src/lib/comms';
import { getPerson } from 'src/lib/people';

export type SendResult =
  | { ok: true; conversationId: string; undoSeconds?: number }
  | { ok: false; message: string };

/**
 * Send an iMessage from the iMessage tab. Into the open thread when there is
 * one; otherwise Comms starts a new one to the person's first phone number
 * (or email). Comms applies its usual signature, opt-out check and undo
 * window, so a teammate in the inbox can still stop it.
 */
const handler = async (
  event: RoutePayload<{
    personId?: string;
    conversationId?: string;
    body?: string;
  }>,
): Promise<SendResult> => {
  const body = event.body?.body?.trim();
  if (!body) return { ok: false, message: 'Write a message first.' };
  try {
    if (event.body?.conversationId) {
      const res = await comms<{ undoSeconds: number }>(
        'POST',
        `/conversations/${event.body.conversationId}/messages`,
        { body },
      );
      return {
        ok: true,
        conversationId: event.body.conversationId,
        undoSeconds: res.undoSeconds,
      };
    }
    if (!event.body?.personId)
      return { ok: false, message: 'No person selected.' };
    const person = await getPerson(new CoreApiClient(), event.body.personId);
    const address = person?.phones[0] ?? person?.emails[0];
    if (!address)
      return {
        ok: false,
        message: 'This person has no phone number or email.',
      };
    const res = await comms<{ conversationId: string; undoSeconds?: number }>(
      'POST',
      '/conversations',
      {
        address,
        body,
      },
    );
    return {
      ok: true,
      conversationId: res.conversationId,
      undoSeconds: res.undoSeconds,
    };
  } catch (err) {
    if (
      err instanceof CommsNotConfiguredError ||
      err instanceof CommsApiError
    ) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: 'Could not reach Comms.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_SEND_UNIVERSAL_IDENTIFIER,
  name: 'send-comms-message',
  description: 'Sends an iMessage to a person through Comms.',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: {
    path: '/comms/send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler,
});
