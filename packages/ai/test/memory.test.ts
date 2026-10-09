import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The model is mocked: these tests pin down what we do with its output —
// sanitising keys, capping lengths, dropping junk — not what it says.
const structured = vi.fn();
vi.mock('../src/client.js', () => ({
  aiStructured: (...args: unknown[]) => structured(...args),
  aiText: vi.fn(),
}));

const { summarizeSession, expandSearchQuery } = await import('../src/memory.js');
const { cosine, embeddingsConfig, embedTexts } = await import('../src/embeddings.js');
const { queryPieces } = await import('../src/load.js');

const NOW = new Date('2026-10-08T12:00:00Z');

describe('summarizeSession', () => {
  beforeEach(() => structured.mockReset());

  it('normalises fact keys and drops ones it cannot use', async () => {
    structured.mockResolvedValue({
      summary: '  Booked the cabin for Dec 30 – Jan 2; $500 deposit sent.  ',
      facts: [
        { key: 'Home City', value: 'Oakland' },
        { key: 'partner-name', value: 'Jess' },
        { key: '123', value: 'starts with a digit' },
        { key: 'empty', value: '   ' },
        { key: '', value: 'no key' },
      ],
      forget: ['Old_Job', 'not a key!'],
    });
    const out = await summarizeSession({
      contactName: 'Sam',
      messages: [{ role: 'contact', text: 'we moved to Oakland', at: NOW }],
      knownFacts: [{ key: 'home_city', value: 'Austin' }],
      now: NOW,
    });
    expect(out.summary).toBe('Booked the cabin for Dec 30 – Jan 2; $500 deposit sent.');
    expect(out.facts).toEqual([
      { key: 'home_city', value: 'Oakland' },
      { key: 'partner_name', value: 'Jess' },
    ]);
    expect(out.forget).toEqual(['old_job']);
  });

  it('shows the model what is already known, so it can update by key', async () => {
    structured.mockResolvedValue({ summary: 'Small talk.', facts: [], forget: [] });
    await summarizeSession({
      contactName: 'Sam',
      messages: [{ role: 'contact', text: 'hi', at: NOW }],
      knownFacts: [{ key: 'home_city', value: 'Austin' }],
      now: NOW,
    });
    const call = structured.mock.calls[0]![0] as { user: string };
    expect(call.user).toContain('Already known about Sam:\n- home_city: Austin');
  });

  it('survives a malformed response', async () => {
    structured.mockResolvedValue({ summary: 42, facts: 'nope', forget: null });
    const out = await summarizeSession({ messages: [{ role: 'contact', text: 'hi' }] });
    expect(out).toEqual({ summary: '42', facts: [], forget: [] });
  });
});

describe('expandSearchQuery', () => {
  it('keeps short, usable terms only', async () => {
    structured.mockResolvedValue({ terms: ['deposit', 'venmo', '$500', 'x', 'a'.repeat(60)] });
    expect(await expandSearchQuery('did I get the deposit back?')).toEqual([
      'deposit',
      'venmo',
      '$500',
    ]);
  });
});

describe('embeddings', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('is off unless a key is set', () => {
    expect(embeddingsConfig({})).toBeNull();
    expect(embeddingsConfig({ EMBEDDINGS_API_KEY: 'k', EMBEDDINGS_DIMENSIONS: '512' })).toEqual({
      apiKey: 'k',
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
      dimensions: 512,
    });
  });

  it('returns vectors in input order even when the provider reorders them', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              { index: 1, embedding: [0, 1] },
              { index: 0, embedding: [1, 0] },
            ],
          }),
        ),
    ) as typeof fetch;
    const out = await embedTexts(['a', 'b'], { apiKey: 'k', baseUrl: 'http://x', model: 'm' });
    expect(out).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it('computes cosine similarity', () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2, 6);
    expect(cosine([1], [1, 2])).toBe(0);
  });
});

describe('queryPieces', () => {
  it('splits a two-topic text so each topic can match on its own', () => {
    expect(
      queryPieces('is the cabin free for New Years? and did we ever get that money back?'),
    ).toEqual([
      'is the cabin free for New Years? and did we ever get that money back?',
      'is the cabin free for New Years?',
      'and did we ever get that money back?',
    ]);
    expect(queryPieces('hiii long time. did we ever get that money back?')).toEqual([
      'hiii long time. did we ever get that money back?',
    ]);
    expect(queryPieces('ok see you then')).toEqual(['ok see you then']);
  });
});
