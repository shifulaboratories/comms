import { pgTable, text, timestamp, index, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { users } from './auth.js';

/**
 * What an API key may do. `read` covers every lookup; `write` adds sending,
 * notes and conversation changes. Kept as a list so a narrower scope can be
 * added later without a migration.
 */
export type ApiScope = 'read' | 'write';

/**
 * Personal API keys. A key acts as the person who made it — same permissions,
 * same name on anything it sends — so an assistant connected over MCP can
 * never see or do more than its owner.
 *
 * Only a SHA-256 of the key is stored. The full key is shown once, at
 * creation; `prefix` is what lets someone tell their keys apart afterwards.
 */
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: text('id').primaryKey().$defaultFn(genId('tok')),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Which integration card made it, e.g. 'claude', 'openai', 'twenty'. */
    client: text('client'),
    tokenHash: text('token_hash').notNull().unique(),
    /** First characters of the key, e.g. `cms_8h2k`, for display only. */
    prefix: text('prefix').notNull(),
    scopes: text('scopes').array().$type<ApiScope[]>().notNull().default(['read']),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('api_tokens_user_idx').on(t.userId)],
);

/** Events an outbound webhook can subscribe to. */
export const WEBHOOK_EVENTS = ['message.received', 'message.sent', 'conversation.created'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Outbound webhooks: Comms POSTs a signed JSON body to `url` when one of
 * `events` happens. This is how a CRM (Twenty, or anything else) hears about
 * new messages without polling.
 *
 * `secret` signs each delivery (HMAC-SHA256 in the `Comms-Signature` header)
 * and is encrypted at rest with APP_SECRET.
 */
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: text('id').primaryKey().$defaultFn(genId('whk')),
  name: text('name').notNull(),
  /** Which integration made it, e.g. 'twenty'; null for one added by hand. */
  client: text('client'),
  url: text('url').notNull(),
  secretEncrypted: text('secret_encrypted').notNull(),
  events: text('events').array().$type<WebhookEvent[]>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  /** Last delivery outcome, for the settings page. */
  lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
  lastStatus: integer('last_status'),
  lastError: text('last_error'),
  /** Consecutive failures; the endpoint is switched off after too many. */
  failureCount: integer('failure_count').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ...timestamps,
});
