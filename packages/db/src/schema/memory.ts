import { pgTable, text, integer, timestamp, real, index, unique } from 'drizzle-orm/pg-core';
import { genId, timestamps } from './_helpers.js';
import { contacts } from './contacts.js';
import { conversations } from './conversations.js';
import { messages } from './messages.js';

/**
 * Long-term memory for the AI.
 *
 * A thread is a run of sessions (stretches of messages with no long silence
 * inside them). Once a session is over, the worker writes a short summary of
 * it here, so later AI calls can carry the gist of months of history in a few
 * lines instead of re-reading — or forgetting — the raw messages.
 */
export const conversationSessions = pgTable(
  'conversation_sessions',
  {
    id: text('id').primaryKey().$defaultFn(genId('ses')),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    messageCount: integer('message_count').notNull(),
    /** One or two sentences, past tense, written by the model. */
    summary: text('summary').notNull(),
    model: text('model'),
    ...timestamps,
  },
  (t) => [
    unique('conversation_sessions_start_uq').on(t.conversationId, t.startedAt),
    index('conversation_sessions_conv_idx').on(t.conversationId, t.endedAt),
  ],
);

/**
 * Durable things known about a person — where they live, who their partner
 * is, how they like to be contacted — kept apart from any one thread.
 *
 * One row per key, so a newer fact replaces an older one ("moved to Denver"
 * replaces "lives in Austin") instead of both being believed. `source` keeps
 * human-entered facts safe from being overwritten by the model.
 */
export const contactFacts = pgTable(
  'contact_facts',
  {
    id: text('id').primaryKey().$defaultFn(genId('fact')),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    /** Short snake_case topic, e.g. `home_city`, `partner`, `dietary`. */
    key: text('key').notNull(),
    value: text('value').notNull(),
    source: text('source', { enum: ['ai', 'human'] })
      .notNull()
      .default('ai'),
    sourceConversationId: text('source_conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    /** When the fact was said, not when it was extracted — facts age too. */
    learnedAt: timestamp('learned_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [unique('contact_facts_key_uq').on(t.contactId, t.key)],
);

/**
 * Vector embeddings of message text, for matching by meaning ("the deposit"
 * ↔ "the $500 I sent you"). Optional: only written when an embeddings
 * provider is configured. Stored as a plain real[] and compared in the app,
 * so it works on any Postgres without the pgvector extension.
 */
export const messageEmbeddings = pgTable(
  'message_embeddings',
  {
    messageId: text('message_id')
      .primaryKey()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    model: text('model').notNull(),
    embedding: real('embedding').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('message_embeddings_conv_idx').on(t.conversationId)],
);
