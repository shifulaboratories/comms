import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, apiTokens, users, type ApiScope } from '@comms/db';
import { db } from '@/server/db';

/**
 * API keys look like `cms_` + 40 base62 characters. The prefix makes a leaked
 * key easy to recognise (and to add to secret scanners); only a SHA-256 of
 * the whole thing is stored.
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateToken(): string {
  const bytes = randomBytes(40);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `cms_${out}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface ApiPrincipal {
  tokenId: string;
  scopes: ApiScope[];
  user: {
    id: string;
    name: string | null;
    email: string;
    permissions: string[];
  };
}

/** Pull a key from `Authorization: Bearer …` or, failing that, `x-api-key`. */
export function tokenFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim() || null;
  return req.headers.get('x-api-key')?.trim() || null;
}

/**
 * Resolve a key to the person it acts as. Returns null for anything unknown,
 * revoked, expired, or belonging to someone who has been deactivated — the
 * caller answers all of those with the same 401, so a probe learns nothing.
 */
export async function authenticateToken(token: string | null): Promise<ApiPrincipal | null> {
  if (!token || !token.startsWith('cms_')) return null;
  const row = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)),
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
    columns: { id: true, name: true, email: true, status: true },
    with: { role: { columns: { permissions: true } } },
  });
  if (!user || user.status !== 'active') return null;

  // Last-used is for the settings page, not an audit log: once a minute is
  // plenty and keeps a chatty assistant from writing on every call.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, row.id))
      .catch(() => {});
  }

  return {
    tokenId: row.id,
    scopes: row.scopes,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      permissions: (user.role?.permissions ?? []) as string[],
    },
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function requireScope(p: ApiPrincipal, scope: ApiScope) {
  if (!p.scopes.includes(scope)) {
    throw new ApiError(
      403,
      `This API key is read-only. Create a key with "${scope}" access to do this.`,
    );
  }
}
