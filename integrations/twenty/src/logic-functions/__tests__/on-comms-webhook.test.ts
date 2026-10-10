import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Twenty's API is mocked: the test pins down who gets matched and what is
// written, not Twenty's GraphQL.
const query = vi.fn();
const mutation = vi.fn();
vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: class {
    query = query;
    mutation = mutation;
  },
}));

const { default: webhook } =
  await import('src/logic-functions/on-comms-webhook');
const handler = (
  webhook as unknown as {
    config: { handler: (e: unknown) => Promise<unknown> };
  }
).config.handler;

const SECRET = 'whsec_test';

function signed(payload: unknown) {
  const raw = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex');
  return {
    headers: { 'comms-signature': `t=${t},v1=${v1}` },
    queryStringParameters: {},
    pathParameters: {},
    body: payload,
    rawBody: raw,
    isBase64Encoded: false,
    requestContext: { http: { method: 'POST', path: '/comms/webhook' } },
    userWorkspaceId: null,
  };
}

const event = {
  id: 'evt_1',
  type: 'message.received',
  createdAt: '2026-10-09T12:00:00Z',
  data: {
    conversation: {
      id: 'conv_1',
      number: 42,
      title: 'Sam Ortiz',
      status: 'open',
      priority: 'normal',
      isGroup: false,
      assignee: null,
      contact: {
        id: 'cont_1',
        name: 'Sam Ortiz',
        company: null,
        phones: ['+14155550177'],
        emails: [],
        optedOut: false,
      },
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadCount: 1,
      url: 'https://comms.example.com/inbox/conv_1',
    },
    message: {
      id: 'msg_1',
      conversationId: 'conv_1',
      direction: 'inbound',
      kind: 'message',
      body: 'is the cabin free?',
      author: { type: 'contact', name: 'Sam Ortiz' },
      status: 'sent',
      createdAt: '2026-10-09T12:00:00Z',
      sentAt: '2026-10-09T12:00:00Z',
    },
  },
};

describe('on-comms-webhook', () => {
  beforeEach(() => {
    process.env.COMMS_WEBHOOK_SECRET = SECRET;
    query.mockReset();
    mutation.mockReset();
  });

  it('rejects an unsigned request', async () => {
    const res = (await handler({ ...signed(event), headers: {} })) as {
      status: number;
    };
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('updates the people whose number matches, ignoring near-misses', async () => {
    query.mockResolvedValue({
      people: {
        edges: [
          {
            node: {
              id: 'p_match',
              name: { firstName: 'Sam', lastName: 'Ortiz' },
              phones: {
                primaryPhoneNumber: '4155550177',
                primaryPhoneCallingCode: '+1',
              },
              emails: { primaryEmail: null },
            },
          },
          {
            node: {
              id: 'p_other',
              name: { firstName: 'Not', lastName: 'Sam' },
              phones: {
                primaryPhoneNumber: '2125550177',
                primaryPhoneCallingCode: '+1',
              },
              emails: { primaryEmail: null },
            },
          },
        ],
      },
    });
    const res = await handler(signed(event));
    expect(res).toEqual({ ok: true, matched: 1 });
    expect(mutation).toHaveBeenCalledTimes(1);
    const data = mutation.mock.calls[0]![0].updatePerson.__args;
    expect(data.id).toBe('p_match');
    expect(data.data.commsLastMessage).toBe('Sam Ortiz: is the cabin free?');
    expect(data.data.commsConversation.primaryLinkUrl).toBe(
      'https://comms.example.com/inbox/conv_1',
    );
  });

  it('answers pings and skips group threads', async () => {
    expect(
      await handler(
        signed({ ...event, type: 'ping', data: { conversation: null } }),
      ),
    ).toEqual({
      ok: true,
      pong: true,
    });
    const group = {
      ...event,
      data: {
        ...event.data,
        conversation: { ...event.data.conversation, isGroup: true },
      },
    };
    expect(await handler(signed(group))).toEqual({ ok: true, matched: 0 });
    expect(query).not.toHaveBeenCalled();
  });
});
