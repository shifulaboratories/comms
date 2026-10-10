import type { Job } from 'bullmq';
import {
  decryptSecret,
  loadConfig,
  logger,
  signWebhook,
  webhooksQueue,
  type WebhookJob,
} from '@comms/core';
import {
  and,
  eq,
  getDb,
  getConversationView,
  getMessageView,
  sql,
  webhookEndpoints,
  type ConversationView,
  type MessageView,
} from '@comms/db';

const log = logger.child({ service: 'webhooks' });

/** After this many failed deliveries in a row an endpoint is switched off. */
const MAX_CONSECUTIVE_FAILURES = 50;
const TIMEOUT_MS = 10_000;

export interface WebhookPayload {
  id: string;
  type: string;
  createdAt: string;
  data: { conversation: ConversationView | null; message?: MessageView | null };
}

async function buildPayload(job: WebhookJob): Promise<WebhookPayload | null> {
  const appUrl = loadConfig().appUrl;
  const message = job.ref.messageId ? await getMessageView(job.ref.messageId) : undefined;
  const conversationId = job.ref.conversationId ?? message?.conversationId;
  const conversation = conversationId ? await getConversationView(conversationId, appUrl) : null;
  // A hidden conversation (verification codes) never leaves through a webhook.
  if (!conversation) return null;
  // Internal notes are for the team, not for other systems.
  if (message?.kind === 'note') return null;
  return {
    id: job.eventId,
    type: job.event,
    createdAt: new Date(job.occurredAt).toISOString(),
    data: { conversation, ...(message !== undefined ? { message } : {}) },
  };
}

export async function processWebhook(job: Job<WebhookJob>): Promise<void> {
  const data = job.data;
  const db = getDb();

  if (data.type === 'emit') {
    const endpoints = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.enabled, true),
          sql`${data.event} = any(${webhookEndpoints.events})`,
        ),
      );
    for (const e of endpoints) {
      await webhooksQueue().add(
        'deliver',
        { ...data, type: 'deliver', endpointId: e.id },
        {
          jobId: `${data.eventId}:${e.id}`,
          attempts: 6,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }
    return;
  }

  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, data.endpointId),
  });
  if (!endpoint || !endpoint.enabled) return;

  const payload = await buildPayload(data);
  if (!payload) return;
  const body = JSON.stringify(payload);
  const secret = decryptSecret(endpoint.secretEncrypted, loadConfig().appSecret);
  const signature = signWebhook(secret, body, Math.floor(Date.now() / 1000));

  let status: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Comms-Webhooks/1',
        'comms-event': payload.type,
        'comms-delivery': `${payload.id}:${endpoint.id}`,
        'comms-signature': signature,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    if (!res.ok) error = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const failed = Boolean(error);
  const failureCount = failed ? endpoint.failureCount + 1 : 0;
  await db
    .update(webhookEndpoints)
    .set({
      lastDeliveryAt: new Date(),
      lastStatus: status,
      lastError: error,
      failureCount,
      ...(failureCount >= MAX_CONSECUTIVE_FAILURES ? { enabled: false } : {}),
    })
    .where(eq(webhookEndpoints.id, endpoint.id));

  if (failed) {
    log.warn({ endpointId: endpoint.id, event: payload.type, error }, 'webhook delivery failed');
    // Throwing hands the job back to BullMQ for its backoff retry.
    throw new Error(error ?? 'delivery failed');
  }
}
