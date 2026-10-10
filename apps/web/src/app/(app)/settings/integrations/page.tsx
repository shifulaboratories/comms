import { and, desc, eq, isNull, apiTokens, webhookEndpoints, WEBHOOK_EVENTS } from '@comms/db';
import { loadConfig } from '@comms/core';
import { can, requireDbUser } from '@/lib/session';
import { db } from '@/server/db';
import { IntegrationsView } from '@/components/settings/integrations/integrations-view';

export const dynamic = 'force-dynamic';

const TWENTY_APP_URL =
  'https://github.com/shifulaboratories/comms/tree/main/integrations/twenty#readme';

export default async function IntegrationsPage() {
  const me = await requireDbUser();
  const canManageWorkspace = can(me, 'workspace.manage');

  const [tokens, webhooks] = await Promise.all([
    db.query.apiTokens.findMany({
      where: and(eq(apiTokens.userId, me.id), isNull(apiTokens.revokedAt)),
      orderBy: [desc(apiTokens.createdAt)],
      columns: { tokenHash: false },
    }),
    canManageWorkspace
      ? db.query.webhookEndpoints.findMany({
          orderBy: [desc(webhookEndpoints.createdAt)],
          columns: { secretEncrypted: false },
        })
      : db.query.webhookEndpoints.findMany({
          where: eq(webhookEndpoints.client, 'twenty'),
          columns: { secretEncrypted: false },
        }),
  ]);
  const twenty = webhooks.find((w) => w.client === 'twenty');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-muted-foreground text-sm">
          Bring your inbox into the AI assistants and tools you already use.
        </p>
      </div>
      <IntegrationsView
        data={{
          appUrl: loadConfig().appUrl,
          canManageWorkspace,
          twentyAppUrl: TWENTY_APP_URL,
          webhookEvents: WEBHOOK_EVENTS,
          tokens: tokens.map((t) => ({
            id: t.id,
            name: t.name,
            client: t.client,
            prefix: t.prefix,
            scopes: t.scopes,
            createdAt: t.createdAt.toISOString(),
            lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          })),
          webhooks: (canManageWorkspace ? webhooks : []).map((w) => ({
            id: w.id,
            name: w.name,
            client: w.client,
            url: w.url,
            events: w.events,
            enabled: w.enabled,
            lastDeliveryAt: w.lastDeliveryAt?.toISOString() ?? null,
            lastStatus: w.lastStatus,
            lastError: w.lastError,
            failureCount: w.failureCount,
          })),
          twenty: twenty
            ? {
                url: (twenty.metadata as { twentyUrl?: string } | null)?.twentyUrl ?? twenty.url,
                connectedAt: twenty.createdAt.toISOString(),
                lastStatus: twenty.lastStatus,
                lastError: twenty.lastError,
              }
            : null,
        }}
      />
    </div>
  );
}
