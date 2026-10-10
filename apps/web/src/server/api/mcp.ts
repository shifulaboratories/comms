import 'server-only';
import { z } from 'zod';
import { ApiError, authenticateToken, type ApiPrincipal } from './tokens';
import * as api from './service';

/**
 * A Model Context Protocol server over Streamable HTTP, stateless.
 *
 * Every request is one JSON-RPC message (or a batch) POSTed to the endpoint
 * and answered with plain JSON — no sessions, no server-to-client stream —
 * which is all a tool server needs and is what Claude, ChatGPT, the OpenAI
 * and Anthropic APIs, and every MCP SDK speak.
 *
 * Tools act as the API key's owner. Read tools are always available; the
 * three write tools are listed only when the key has write access, so a
 * read-only assistant is never even offered them.
 */

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'comms', title: 'Comms', version: '1.0.0' };

const INSTRUCTIONS = `Comms is a shared iMessage inbox. Conversations are threads with one person (or a group); each has a status (open, pending, snoozed, closed), an optional assignee and a priority.

Use search_conversations or find_contacts to locate a thread, then get_conversation to read it before replying. Messages you send go out over iMessage as the person who owns this API key, after a short undo window. Internal notes are visible only to the team. Never send a message the user has not clearly asked you to send.`;

type Json = Record<string, unknown>;

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  write?: boolean;
  annotations: Json;
  run: (p: ApiPrincipal, args: Json) => Promise<unknown>;
}

const str = (description: string, extra: Json = {}) => ({ type: 'string', description, ...extra });
const int = (description: string, min: number, max: number) => ({
  type: 'integer',
  description,
  minimum: min,
  maximum: max,
});

const STATUS = ['open', 'pending', 'snoozed', 'closed'] as const;
const PRIORITY = ['low', 'normal', 'high', 'urgent'] as const;

const TOOLS: Tool[] = [
  {
    name: 'whoami',
    title: 'Who am I',
    description: 'The Comms user this connection acts as, and whether it can send messages.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (p) => api.whoAmI(p),
  },
  {
    name: 'search_conversations',
    title: 'Search conversations',
    description:
      'Full-text search across message history, contact names and conversation titles. Supports quoted phrases, OR and -exclusions. Returns matching conversations, newest match first, each with the best-matching message.',
    inputSchema: {
      type: 'object',
      properties: {
        query: str('What to search for, e.g. "refund" or "\\"tracking number\\" -amazon"'),
        limit: int('Max conversations to return (default 10)', 1, 25),
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (p, a) => {
      const { query, limit } = z
        .object({ query: z.string(), limit: z.number().int().optional() })
        .parse(a);
      return { results: await api.searchConversations(p, query, limit) };
    },
  },
  {
    name: 'list_conversations',
    title: 'List conversations',
    description:
      'List conversations by most recent activity. Defaults to open conversations across the team.',
    inputSchema: {
      type: 'object',
      properties: {
        status: str('Filter by status (default "open")', { enum: [...STATUS, 'all'] }),
        assigned: str('"me" for mine, "unassigned", or "any" (default)', {
          enum: ['me', 'unassigned', 'any'],
        }),
        limit: int('Max conversations (default 20)', 1, 100),
        before: str('ISO timestamp: only conversations last active before this, for paging'),
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (p, a) => {
      const q = z
        .object({
          status: z.enum([...STATUS, 'all']).optional(),
          assigned: z.enum(['me', 'unassigned', 'any']).optional(),
          limit: z.number().int().optional(),
          before: z.string().optional(),
        })
        .parse(a);
      return { conversations: await api.listConversations(p, q) };
    },
  },
  {
    name: 'get_conversation',
    title: 'Read a conversation',
    description:
      'Read a conversation: its details, the most recent messages (oldest first), and what is known about the person. Call this before replying.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: str('Conversation id, e.g. conv_…'),
        message_limit: int('How many recent messages (default 30)', 1, 200),
        before: str('ISO timestamp: only messages before this, to read further back'),
        include_notes: { type: 'boolean', description: "Include the team's internal notes" },
      },
      required: ['conversation_id'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (p, a) => {
      const q = z
        .object({
          conversation_id: z.string(),
          message_limit: z.number().int().optional(),
          before: z.string().optional(),
          include_notes: z.boolean().optional(),
        })
        .parse(a);
      return api.getConversation(p, q.conversation_id, {
        messageLimit: q.message_limit,
        before: q.before,
        includeNotes: q.include_notes,
      });
    },
  },
  {
    name: 'find_contacts',
    title: 'Find contacts',
    description: 'Find people by name, phone number (any format) or email address.',
    inputSchema: {
      type: 'object',
      properties: {
        query: str('A name, phone number or email'),
        limit: int('Max contacts (default 10)', 1, 50),
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (p, a) => {
      const q = z.object({ query: z.string(), limit: z.number().int().optional() }).parse(a);
      return { contacts: await api.findContacts(p, q) };
    },
  },
  {
    name: 'get_contact',
    title: 'Get a contact',
    description: "A person's details, what is known about them, and their recent conversations.",
    inputSchema: {
      type: 'object',
      properties: { contact_id: str('Contact id, e.g. cont_…') },
      required: ['contact_id'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (p, a) =>
      api.getContact(p, z.object({ contact_id: z.string() }).parse(a).contact_id),
  },
  {
    name: 'list_teammates',
    title: 'List teammates',
    description: 'Active people on the Comms team, for assigning conversations.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (p) => ({ teammates: await api.listTeammates(p) }),
  },
  {
    name: 'send_message',
    title: 'Send a message',
    description:
      'Send an iMessage reply in a conversation, as the owner of this connection. It goes out after the workspace undo window. Only send what the user has asked you to send.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: str('Conversation id, e.g. conv_…'),
        body: str('The message text'),
      },
      required: ['conversation_id', 'body'],
    },
    write: true,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    run: async (p, a) => {
      const q = z.object({ conversation_id: z.string(), body: z.string().min(1) }).parse(a);
      return api.sendReply(p, q.conversation_id, q.body);
    },
  },
  {
    name: 'start_conversation',
    title: 'Message someone new',
    description:
      'Send an iMessage to a phone number or email. If a conversation with them already exists the message is added there. Only send what the user has asked you to send.',
    inputSchema: {
      type: 'object',
      properties: {
        address: str('Phone number (any format) or email address'),
        body: str('The message text'),
      },
      required: ['address', 'body'],
    },
    write: true,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    run: async (p, a) => {
      const q = z.object({ address: z.string().min(3), body: z.string().min(1) }).parse(a);
      return api.startConversation(p, q);
    },
  },
  {
    name: 'add_note',
    title: 'Add an internal note',
    description:
      'Add an internal note to a conversation. Notes are visible only to the team and are never sent. @name mentions notify teammates.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: str('Conversation id, e.g. conv_…'),
        body: str('The note text'),
      },
      required: ['conversation_id', 'body'],
    },
    write: true,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    run: async (p, a) => {
      const q = z.object({ conversation_id: z.string(), body: z.string().min(1) }).parse(a);
      return api.addNote(p, q.conversation_id, q.body);
    },
  },
  {
    name: 'update_conversation',
    title: 'Update a conversation',
    description: "Change a conversation's status, priority or assignee.",
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: str('Conversation id, e.g. conv_…'),
        status: str('New status', { enum: [...STATUS] }),
        priority: str('New priority', { enum: [...PRIORITY] }),
        assignee_email: str('Email of the teammate to assign; empty string to unassign'),
      },
      required: ['conversation_id'],
    },
    write: true,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: async (p, a) => {
      const q = z
        .object({
          conversation_id: z.string(),
          status: z.enum(STATUS).optional(),
          priority: z.enum(PRIORITY).optional(),
          assignee_email: z.string().optional(),
        })
        .parse(a);
      return {
        conversation: await api.updateConversation(p, q.conversation_id, {
          status: q.status,
          priority: q.priority,
          assigneeEmail: q.assignee_email,
        }),
      };
    },
  },
];

export const MCP_TOOL_NAMES = TOOLS.map((t) => ({
  name: t.name,
  title: t.title,
  write: Boolean(t.write),
}));

function toolsFor(p: ApiPrincipal) {
  return TOOLS.filter((t) => !t.write || p.scopes.includes('write'));
}

interface RpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Json;
}

const rpcResult = (id: RpcRequest['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id: RpcRequest['id'] | null, code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

async function handleOne(p: ApiPrincipal, msg: RpcRequest): Promise<unknown | null> {
  // Notifications (no id) get no response.
  const isNotification = msg.id === undefined;
  try {
    switch (msg.method) {
      case 'initialize': {
        const requested = String(msg.params?.protocolVersion ?? '');
        return rpcResult(msg.id, {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested)
            ? requested
            : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping':
        return rpcResult(msg.id, {});
      case 'tools/list':
        return rpcResult(msg.id, {
          tools: toolsFor(p).map(({ name, title, description, inputSchema, annotations }) => ({
            name,
            title,
            description,
            inputSchema,
            annotations: { title, ...annotations },
          })),
        });
      case 'tools/call': {
        const name = String(msg.params?.name ?? '');
        const tool = toolsFor(p).find((t) => t.name === name);
        if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${name}`);
        try {
          const out = await tool.run(p, (msg.params?.arguments as Json) ?? {});
          const structured = (
            out && typeof out === 'object' && !Array.isArray(out) ? out : { result: out }
          ) as Json;
          return rpcResult(msg.id, {
            content: [{ type: 'text', text: JSON.stringify(structured, null, 1) }],
            structuredContent: structured,
          });
        } catch (err) {
          // Tool failures are results the model can read and recover from,
          // not protocol errors.
          const text =
            err instanceof z.ZodError
              ? `Invalid arguments: ${err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`
              : err instanceof ApiError
                ? err.message
                : 'Something went wrong running this tool.';
          if (!(err instanceof z.ZodError) && !(err instanceof ApiError))
            console.error('[mcp] tool error', name, err);
          return rpcResult(msg.id, { content: [{ type: 'text', text }], isError: true });
        }
      }
      case 'resources/list':
        return rpcResult(msg.id, { resources: [] });
      case 'resources/templates/list':
        return rpcResult(msg.id, { resourceTemplates: [] });
      case 'prompts/list':
        return rpcResult(msg.id, { prompts: [] });
      default:
        if (isNotification) return null;
        return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  } finally {
    // nothing to clean up: the server is stateless
  }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers':
    'authorization, content-type, mcp-protocol-version, mcp-session-id, x-api-key',
  'access-control-expose-headers': 'www-authenticate',
};

export function mcpOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/** GET opens a server-to-client stream in the spec; this server has none. */
export function mcpGet() {
  return new Response(
    JSON.stringify(rpcError(null, -32000, 'Use POST. This server does not stream.')),
    {
      status: 405,
      headers: { ...CORS, allow: 'POST, OPTIONS', 'content-type': 'application/json' },
    },
  );
}

export async function mcpPost(req: Request, token: string | null): Promise<Response> {
  const principal = await authenticateToken(token);
  if (!principal) {
    return new Response(
      JSON.stringify(rpcError(null, -32001, 'Missing or invalid Comms API key.')),
      {
        status: 401,
        headers: {
          ...CORS,
          'content-type': 'application/json',
          'www-authenticate': 'Bearer realm="comms", error="invalid_token"',
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400, headers: CORS });
  }

  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as RpcRequest[];
  if (
    msgs.length === 0 ||
    msgs.some((m) => !m || typeof m !== 'object' || typeof m.method !== 'string')
  ) {
    // Responses from a client (to requests we never make) are accepted and ignored.
    if (msgs.every((m) => m && typeof m === 'object' && ('result' in m || 'error' in m))) {
      return new Response(null, { status: 202, headers: CORS });
    }
    return Response.json(rpcError(null, -32600, 'Invalid request'), { status: 400, headers: CORS });
  }

  const replies = (await Promise.all(msgs.map((m) => handleOne(principal, m)))).filter(
    (r) => r !== null,
  );
  if (replies.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? replies : replies[0], { headers: CORS });
}
