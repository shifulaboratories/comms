/**
 * Text embeddings for matching by meaning — "the deposit" and "the $500 I
 * sent you" share no words but mean the same thing.
 *
 * Optional and provider-agnostic: any OpenAI-compatible `/embeddings`
 * endpoint works (OpenAI, Voyage, Together, a local Ollama). Anthropic has no
 * embeddings API, so this is necessarily a second key — the same shape as the
 * transcription setting. Unset means recall stays lexical and nothing breaks.
 *
 *   EMBEDDINGS_API_KEY=…
 *   EMBEDDINGS_BASE_URL=https://api.openai.com/v1   (default)
 *   EMBEDDINGS_MODEL=text-embedding-3-small         (default)
 *   EMBEDDINGS_DIMENSIONS=512                       (optional; sent only if set)
 */

export interface EmbeddingsConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions?: number;
}

export function embeddingsConfig(env: NodeJS.ProcessEnv = process.env): EmbeddingsConfig | null {
  const apiKey = env.EMBEDDINGS_API_KEY?.trim();
  if (!apiKey) return null;
  const dims = Number(env.EMBEDDINGS_DIMENSIONS);
  return {
    apiKey,
    baseUrl: (env.EMBEDDINGS_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: env.EMBEDDINGS_MODEL?.trim() || 'text-embedding-3-small',
    dimensions: Number.isFinite(dims) && dims > 0 ? dims : undefined,
  };
}

export function isEmbeddingsConfigured(): boolean {
  return embeddingsConfig() !== null;
}

/** Embed a batch of texts. Returns one vector per input, in order. */
export async function embedTexts(texts: string[], cfg = embeddingsConfig()): Promise<number[][]> {
  if (!cfg) throw new Error('Embeddings are not configured.');
  if (texts.length === 0) return [];
  const res = await fetch(`${cfg.baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      // Long messages are truncated: the gist of a text lives in its first
      // couple of thousand characters, and providers cap input length anyway.
      input: texts.map((t) => t.slice(0, 2000)),
      ...(cfg.dimensions ? { dimensions: cfg.dimensions } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Embeddings request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { index?: number; embedding: number[] }[] };
  const data = json.data ?? [];
  const out: number[][] = new Array(texts.length);
  data.forEach((d, i) => {
    out[d.index ?? i] = d.embedding;
  });
  if (out.some((v) => !Array.isArray(v))) throw new Error('Embeddings response was incomplete.');
  return out;
}

/** Cosine similarity; 0 for mismatched or empty vectors. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
