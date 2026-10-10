import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { FN_WEBHOOK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { verifyCommsSignature, type CommsWebhookEvent } from 'src/lib/comms';
import { findPeopleForContact } from 'src/lib/people';

/**
 * Receives Comms' signed webhooks. On every live message it finds the people
 * in Twenty with the same phone number or email and updates their "Last
 * iMessage" fields, so lists can be sorted and filtered by who you've been
 * texting — the thread itself is read live from Comms by the iMessage tab.
 */
const handler = async (event: RoutePayload<CommsWebhookEvent>) => {
  const secret = process.env.COMMS_WEBHOOK_SECRET?.trim();
  const raw = event.rawBody ?? (event.body ? JSON.stringify(event.body) : '');
  if (
    !secret ||
    !verifyCommsSignature(secret, raw, event.headers['comms-signature'])
  ) {
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const payload = (event.body ?? JSON.parse(raw)) as CommsWebhookEvent;
  if (payload.type === 'ping') return { ok: true, pong: true };
  if (payload.type !== 'message.received' && payload.type !== 'message.sent') {
    return { ok: true, ignored: payload.type };
  }

  const { conversation, message } = payload.data;
  const contact = conversation?.contact;
  // Group threads aren't one person's history.
  if (!conversation || !message || !contact || conversation.isGroup) {
    return { ok: true, matched: 0 };
  }

  // The webhook route has no signed-in user, so it acts as the app.
  const client = new CoreApiClient({ runAs: 'application' });
  const people = await findPeopleForContact(client, contact);
  const who =
    message.direction === 'inbound'
      ? contact.name || 'Them'
      : message.author.name || 'You';
  const preview = `${who}: ${message.body}`.slice(0, 280);

  for (const person of people) {
    await client.mutation({
      updatePerson: {
        __args: {
          id: person.id,
          data: {
            commsLastMessageAt: message.sentAt ?? message.createdAt,
            commsLastMessage: preview,
            commsConversation: {
              primaryLinkUrl: conversation.url,
              primaryLinkLabel: `Comms #${conversation.number}`,
              secondaryLinks: null,
            },
          },
        },
        id: true,
      },
    });
  }
  return { ok: true, matched: people.length };
};

export default defineLogicFunction({
  universalIdentifier: FN_WEBHOOK_UNIVERSAL_IDENTIFIER,
  name: 'on-comms-webhook',
  description:
    'Updates people in Twenty when an iMessage is sent or received in Comms.',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: {
    path: '/comms/webhook',
    httpMethod: 'POST',
    // Comms is not a Twenty user; the HMAC signature is the authentication.
    isAuthRequired: false,
    forwardedRequestHeaders: ['comms-signature', 'comms-event', 'content-type'],
  },
  handler,
});
