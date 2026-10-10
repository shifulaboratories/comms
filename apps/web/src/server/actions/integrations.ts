'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import {
  and,
  desc,
  eq,
  isNull,
  apiTokens,
  webhookEndpoints,
  WEBHOOK_EVENTS,
  type ApiScope,
  type WebhookEvent,
} from '@comms/db';
import { encryptSecret, decryptSecret, loadConfig, signWebhook } from '@comms/core';
import { db } from '@/server/db';
import { can, requirePermission, requireWriter } from '@/lib/session';
import { generateToken, hashToken } from '@/server/api/tokens';

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const CLIENTS = ['claude', 'openai', 'custom', 'twenty'] as const;
type Client = (typeof CLIENTS)[number];

async function mintToken(
  userId: string,
  input: { name: string; client: Client; scopes: ApiScope[] },
): Promise<{ id: string; token: string; prefix: string }> {
  const token = generateToken();
  const prefix = token.slice(0, 8);
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId,
      name: input.name.trim().slice(0, 80) || 'API key',
      client: input.client,
      tokenHash: hashToken(token),
      prefix,
      scopes: input.scopes,
    })
    .returning({ id: apiTokens.id });
  return { id: row!.id, token, prefix };
}

/**
 * Create a personal API key. The full key is returned exactly once; only its
 * hash is kept. It acts as you, so it can never do more than you can.
 */
export async function createApiToken(input: {
  name: string;
  client: string;
  access: 'read' | 'write';
}): Promise<Result<{ token: string; id: string; prefix: string }>> {
  const me = await requireWriter();
  const client = (CLIENTS as readonly string[]).includes(input.client)
    ? (input.client as Client)
    : 'custom';
  const scopes: ApiScope[] = input.access === 'write' ? ['read', 'write'] : ['read'];
  const minted = await mintToken(me.id, { name: input.name, client, scopes });
  revalidatePath('/settings/integrations');
  return { ok: true, ...minted };
}

/** Revoke a key. Your own always; anyone's with the admin permission. */
export async function revokeApiToken(id: string): Promise<Result> {
  const me = await requireWriter();
  const row = await db.query.apiTokens.findFirst({ where: eq(apiTokens.id, id) });
  if (!row) return { ok: false, error: 'Key not found.' };
  if (row.userId !== me.id && !can(me, 'system.admin')) {
    return { ok: false, error: 'You can only revoke your own keys.' };
  }
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)));
  revalidatePath('/settings/integrations');
  return { ok: true };
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * Connect a Twenty workspace. Mints a read-and-write key for the Twenty app
 * to call Comms with, and a webhook that tells it about new messages. Both
 * secrets are returned once, to paste into the app's settings in Twenty.
 *
 * Connecting again replaces the previous connection rather than piling up
 * keys and duplicate webhooks.
 */
export async function connectTwenty(input: {
  twentyUrl: string;
}): Promise<
  Result<{ apiToken: string; webhookSecret: string; commsUrl: string; webhookUrl: string }>
> {
  const me = await requirePermission('workspace.manage');
  const base = normalizeUrl(input.twentyUrl);
  if (!base)
    return {
      ok: false,
      error: 'Enter the full address of your Twenty workspace, e.g. https://crm.example.com',
    };

  await disconnectTwentyInternal();

  const minted = await mintToken(me.id, {
    name: `Twenty CRM (${new URL(base).host})`,
    client: 'twenty',
    scopes: ['read', 'write'],
  });
  const webhookSecret = `whsec_${randomBytes(24).toString('base64url')}`;
  const webhookUrl = `${base}/s/comms/webhook`;
  await db.insert(webhookEndpoints).values({
    name: 'Twenty CRM',
    client: 'twenty',
    url: webhookUrl,
    secretEncrypted: encryptSecret(webhookSecret, loadConfig().appSecret),
    events: ['message.received', 'message.sent'],
    createdByUserId: me.id,
    metadata: { twentyUrl: base, tokenId: minted.id },
  });
  revalidatePath('/settings/integrations');
  return {
    ok: true,
    apiToken: minted.token,
    webhookSecret,
    commsUrl: loadConfig().appUrl,
    webhookUrl,
  };
}

async function disconnectTwentyInternal() {
  const existing = await db.query.webhookEndpoints.findMany({
    where: eq(webhookEndpoints.client, 'twenty'),
  });
  for (const e of existing) {
    const tokenId = (e.metadata as { tokenId?: string } | null)?.tokenId;
    if (tokenId) {
      await db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, tokenId));
    }
  }
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.client, 'twenty'));
}

export async function disconnectTwenty(): Promise<Result> {
  await requirePermission('workspace.manage');
  await disconnectTwentyInternal();
  revalidatePath('/settings/integrations');
  return { ok: true };
}

/** Add a webhook by hand, for any system that wants Comms events. */
export async function createWebhook(input: {
  name: string;
  url: string;
  events: string[];
}): Promise<Result<{ secret: string }>> {
  const me = await requirePermission('workspace.manage');
  const url = normalizeUrl(input.url);
  if (!url) return { ok: false, error: 'Enter a full http(s) URL.' };
  const events = input.events.filter((e): e is WebhookEvent =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e),
  );
  if (events.length === 0) return { ok: false, error: 'Pick at least one event.' };
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  await db.insert(webhookEndpoints).values({
    name: input.name.trim().slice(0, 80) || new URL(url).host,
    url,
    secretEncrypted: encryptSecret(secret, loadConfig().appSecret),
    events,
    createdByUserId: me.id,
  });
  revalidatePath('/settings/integrations');
  return { ok: true, secret };
}

export async function deleteWebhook(id: string): Promise<Result> {
  await requirePermission('workspace.manage');
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
  revalidatePath('/settings/integrations');
  return { ok: true };
}

export async function setWebhookEnabled(id: string, enabled: boolean): Promise<Result> {
  await requirePermission('workspace.manage');
  await db
    .update(webhookEndpoints)
    .set({ enabled, ...(enabled ? { failureCount: 0 } : {}) })
    .where(eq(webhookEndpoints.id, id));
  revalidatePath('/settings/integrations');
  return { ok: true };
}

/** Send a signed `ping` right now and report what came back. */
export async function testWebhook(id: string): Promise<Result<{ status: number }>> {
  await requirePermission('workspace.manage');
  const e = await db.query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.id, id) });
  if (!e) return { ok: false, error: 'Webhook not found.' };
  const body = JSON.stringify({
    id: `evt_ping_${Date.now().toString(36)}`,
    type: 'ping',
    createdAt: new Date().toISOString(),
    data: { conversation: null },
  });
  const secret = decryptSecret(e.secretEncrypted, loadConfig().appSecret);
  try {
    const res = await fetch(e.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Comms-Webhooks/1',
        'comms-event': 'ping',
        'comms-signature': signWebhook(secret, body, Math.floor(Date.now() / 1000)),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    await db
      .update(webhookEndpoints)
      .set({
        lastDeliveryAt: new Date(),
        lastStatus: res.status,
        lastError: res.ok ? null : `HTTP ${res.status}`,
      })
      .where(eq(webhookEndpoints.id, id));
    revalidatePath('/settings/integrations');
    return res.ok
      ? { ok: true, status: res.status }
      : { ok: false, error: `The endpoint answered HTTP ${res.status}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Could not reach the endpoint: ${message}` };
  }
}
