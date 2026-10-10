import { defineLogicFunction } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { FN_THREAD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  comms,
  CommsApiError,
  CommsNotConfiguredError,
  type CommsContact,
  type CommsConversation,
  type CommsMessage,
} from 'src/lib/comms';
import { getPerson } from 'src/lib/people';

export type ThreadResult =
  | { status: 'not_configured'; message: string }
  | { status: 'error'; message: string }
  | { status: 'no_address'; personName: string }
  | {
      status: 'no_conversation';
      personName: string;
      address: string;
      contact: CommsContact | null;
    }
  | {
      status: 'ok';
      personName: string;
      contact: CommsContact;
      conversation: CommsConversation;
      messages: CommsMessage[];
      otherConversations: CommsConversation[];
    };

/**
 * The person's iMessage thread, fetched live from Comms for the iMessage tab.
 * The front component can't hold the Comms key (secrets never reach the
 * browser), so it calls this route and the key stays on the server.
 */
const handler = async (
  event: RoutePayload<{ personId?: string; conversationId?: string }>,
): Promise<ThreadResult> => {
  const personId = event.body?.personId;
  if (!personId) return { status: 'error', message: 'No person selected.' };

  try {
    const person = await getPerson(new CoreApiClient(), personId);
    if (!person) return { status: 'error', message: 'Person not found.' };
    const address = person.phones[0] ?? person.emails[0];
    if (!address) return { status: 'no_address', personName: person.name };

    // Every number and email on the person, until one is known to Comms.
    let contact: CommsContact | null = null;
    for (const phone of person.phones) {
      contact =
        (
          await comms<CommsContact[]>(
            'GET',
            `/contacts?phone=${encodeURIComponent(phone)}`,
          )
        )[0] ?? null;
      if (contact) break;
    }
    if (!contact) {
      for (const email of person.emails) {
        contact =
          (
            await comms<CommsContact[]>(
              'GET',
              `/contacts?email=${encodeURIComponent(email)}`,
            )
          )[0] ?? null;
        if (contact) break;
      }
    }
    if (!contact)
      return {
        status: 'no_conversation',
        personName: person.name,
        address,
        contact: null,
      };

    const conversations = await comms<CommsConversation[]>(
      'GET',
      `/conversations?contactId=${contact.id}&status=all&limit=10`,
    );
    const oneToOne = conversations.filter((c) => !c.isGroup);
    const chosen =
      oneToOne.find((c) => c.id === event.body?.conversationId) ??
      oneToOne[0] ??
      conversations[0];
    if (!chosen)
      return {
        status: 'no_conversation',
        personName: person.name,
        address,
        contact,
      };

    const detail = await comms<{
      conversation: CommsConversation;
      messages: CommsMessage[];
    }>('GET', `/conversations/${chosen.id}?messages=50`);
    return {
      status: 'ok',
      personName: person.name,
      contact,
      conversation: detail.conversation,
      messages: detail.messages,
      otherConversations: conversations.filter((c) => c.id !== chosen.id),
    };
  } catch (err) {
    if (err instanceof CommsNotConfiguredError)
      return { status: 'not_configured', message: err.message };
    if (err instanceof CommsApiError && err.status === 401) {
      return {
        status: 'not_configured',
        message: 'Comms rejected the API key. Reconnect Twenty in Comms.',
      };
    }
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_THREAD_UNIVERSAL_IDENTIFIER,
  name: 'get-comms-thread',
  description: "Loads a person's iMessage thread from Comms.",
  timeoutSeconds: 20,
  httpRouteTriggerSettings: {
    path: '/comms/thread',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler,
});
