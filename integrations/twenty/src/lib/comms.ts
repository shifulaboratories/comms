import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * A small client for the Comms REST API (`/api/v1`), plus the shapes it
 * returns. Kept dependency-free so the logic-function bundles stay small.
 */

export interface CommsContact {
  id: string;
  name: string | null;
  company: string | null;
  phones: string[];
  emails: string[];
  optedOut: boolean;
}

export interface CommsConversation {
  id: string;
  number: number;
  title: string;
  status: 'open' | 'pending' | 'snoozed' | 'closed';
  priority: string;
  isGroup: boolean;
  assignee: { id: string; name: string | null; email: string } | null;
  contact: CommsContact | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  url: string;
}

export interface CommsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  kind: 'message' | 'note';
  body: string;
  author: { type: string; name: string | null };
  status: string;
  createdAt: string;
  sentAt: string | null;
}

export interface CommsWebhookEvent {
  id: string;
  type: 'message.received' | 'message.sent' | 'conversation.created' | 'ping';
  createdAt: string;
  data: {
    conversation: CommsConversation | null;
    message?: CommsMessage | null;
  };
}

export class CommsNotConfiguredError extends Error {
  constructor() {
    super('Add COMMS_URL and COMMS_API_KEY in this app’s settings.');
  }
}

export class CommsApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function commsConfig(): { url: string; key: string } {
  const url = process.env.COMMS_URL?.trim().replace(/\/+$/, '');
  const key = process.env.COMMS_API_KEY?.trim();
  if (!url || !key) throw new CommsNotConfiguredError();
  return { url, key };
}

export async function comms<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const { url, key } = commsConfig();
  const res = await fetch(`${url}/api/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as
    | { data: T }
    | { error: { message: string } }
    | null;
  if (!res.ok || !json || 'error' in json) {
    const message =
      json && 'error' in json
        ? json.error.message
        : `Comms answered HTTP ${res.status}`;
    throw new CommsApiError(res.status, message);
  }
  return json.data;
}

/**
 * Verify a `Comms-Signature: t=<unix>,v1=<hex>` header: HMAC-SHA256 of
 * `<t>.<raw body>` with the webhook secret, within five minutes.
 */
export function verifyCommsSignature(
  secret: string,
  rawBody: string,
  header: string | undefined,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = new Map(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()] as const;
    }),
  );
  const t = Number(parts.get('t'));
  const v1 = parts.get('v1');
  if (!Number.isFinite(t) || !v1 || Math.abs(now - t) > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Last ten digits of a phone number: enough to identify a person, short
 * enough to survive country codes and formatting. Comms joins numbers the
 * same way.
 */
export function phoneKey(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : null;
}
