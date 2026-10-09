import type Anthropic from '@anthropic-ai/sdk';
import { aiStructured } from './client.js';
import { formatTranscript, type TranscriptMessage } from './transcript.js';
import type { ContactFact } from './context.js';

/**
 * Long-term memory: what the worker writes once a session is over, so later
 * AI calls can carry months of history in a few lines.
 *
 * One call per finished session does two jobs — a short summary of what
 * happened, and any durable facts about the person that came up — because
 * both need the same read of the same messages.
 */

export interface SessionMemory {
  /** One or two sentences, past tense. */
  summary: string;
  /** Facts to add or replace, keyed so a newer value supersedes an older one. */
  facts: { key: string; value: string }[];
  /** Keys of known facts this session shows are no longer true. */
  forget: string[];
}

const MEMORY_TOOL: Anthropic.Tool = {
  name: 'record_session_memory',
  description:
    'Record a summary of this finished conversation session and any durable facts it revealed.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      summary: {
        type: 'string',
        description:
          'One or two sentences, past tense, naming what was asked, decided or arranged — with any dates, amounts and outcomes. No greetings or filler.',
      },
      facts: {
        type: 'array',
        description:
          'Durable facts about the OTHER person that will still matter in months: where they live, family and partner names, birthday, job, preferences, allergies, how they like to be contacted, recurring arrangements. Not one-off logistics, not moods, not anything about us.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            key: {
              type: 'string',
              description:
                'Short snake_case topic, reusing a known key when the fact updates it (e.g. home_city, partner, birthday, dietary).',
            },
            value: { type: 'string', description: 'The fact, in a few words.' },
          },
          required: ['key', 'value'],
        },
      },
      forget: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Keys of known facts that this session shows are no longer true and have no replacement.',
      },
    },
    required: ['summary', 'facts', 'forget'],
  },
};

const KEY_RE = /^[a-z][a-z0-9_]{1,39}$/;

export async function summarizeSession(input: {
  contactName?: string | null;
  messages: TranscriptMessage[];
  knownFacts?: ContactFact[];
  now?: Date;
}): Promise<SessionMemory> {
  const known = (input.knownFacts ?? []).map((f) => `- ${f.key}: ${f.value}`).join('\n');
  const data = (await aiStructured({
    maxTokens: 700,
    system: [
      'You maintain long-term memory for a shared text-message inbox.',
      'You are given one finished session of a conversation (a stretch of messages with no long break) and what is already known about the person.',
      'Write a factual summary of the session, and record only facts about the person that will plausibly still be true and useful months from now.',
      'If a known fact changed, record the new value under the SAME key. If the session does not mention a known fact, leave it alone — do not repeat it and do not forget it.',
      'Never invent anything; if the session is small talk, say so in a few words and record no facts.',
    ].join(' '),
    user: `${known ? `Already known about ${input.contactName ?? 'this person'}:\n${known}\n\n` : ''}Session:\n${formatTranscript(input.messages, input.contactName, { now: input.now })}`,
    tool: MEMORY_TOOL,
  })) as Partial<SessionMemory>;

  const facts = (Array.isArray(data.facts) ? data.facts : [])
    .map((f) => ({
      key: String(f?.key ?? '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, ''),
      value: String(f?.value ?? '')
        .trim()
        .slice(0, 200),
    }))
    .filter((f) => KEY_RE.test(f.key) && f.value)
    .slice(0, 8);
  return {
    summary: String(data.summary ?? '')
      .trim()
      .slice(0, 500),
    facts,
    forget: (Array.isArray(data.forget) ? data.forget : [])
      .map((k) => String(k).toLowerCase().trim())
      .filter((k) => KEY_RE.test(k))
      .slice(0, 8),
  };
}

const EXPAND_TOOL: Anthropic.Tool = {
  name: 'record_search_terms',
  description: 'Record search terms for finding the answer in a text-message archive.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      terms: {
        type: 'array',
        items: { type: 'string' },
        description:
          '3–8 single words or short phrases someone would actually have TEXTED when talking about this — synonyms, related words, likely amounts or places — not the question itself.',
      },
    },
    required: ['terms'],
  },
};

/**
 * Turn a question into the words the answer was probably written in.
 *
 * Full-text search only finds messages that share words with the question;
 * "what did we agree about the deposit" misses "ok I'll venmo you the $500".
 * Cheap insurance for archive search when no embeddings are configured, and
 * a useful extra signal when they are.
 */
export async function expandSearchQuery(question: string): Promise<string[]> {
  const data = (await aiStructured({
    maxTokens: 200,
    system:
      'You help search a personal text-message archive. Given a question, list words and short phrases the relevant messages were likely written with.',
    user: question,
    tool: EXPAND_TOOL,
  })) as { terms?: unknown };
  return (Array.isArray(data.terms) ? data.terms : [])
    .map((t) => String(t).trim())
    .filter((t) => t.length >= 2 && t.length <= 40)
    .slice(0, 8);
}
