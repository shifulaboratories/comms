'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Plus,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import {
  connectTwenty,
  createWebhook,
  deleteWebhook,
  disconnectTwenty,
  revokeApiToken,
  setWebhookEnabled,
  testWebhook,
} from '@/server/actions/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { McpConnectDialog, MCP_CLIENTS, type McpClient } from './mcp-connect';
import { CopyField, Kbd, Steps } from './shared';
import { TwentyMark } from './logos';

export interface TokenRow {
  id: string;
  name: string;
  client: string | null;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface WebhookRow {
  id: string;
  name: string;
  client: string | null;
  url: string;
  events: string[];
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  failureCount: number;
}

export interface IntegrationsData {
  appUrl: string;
  canManageWorkspace: boolean;
  tokens: TokenRow[];
  webhooks: WebhookRow[];
  twenty: {
    url: string;
    connectedAt: string;
    lastStatus: number | null;
    lastError: string | null;
  } | null;
  webhookEvents: readonly string[];
  /** Where the Twenty app's source and install steps live. */
  twentyAppUrl: string;
}

export function IntegrationsView({ data }: { data: IntegrationsData }) {
  const [mcp, setMcp] = useState<McpClient | null>(null);
  const counts = (id: string) => data.tokens.filter((t) => t.client === id).length;

  return (
    <div className="space-y-10">
      {/* ── AI assistants ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHead
          title="AI assistants"
          body="Connect an assistant to your inbox over MCP. It can search and read conversations, look people up, and — if you allow it — reply, add notes and triage."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {MCP_CLIENTS.map((c) => {
            const n = counts(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setMcp(c.id)}
                className="bg-card hover:border-border-strong group flex flex-col rounded-xl border p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <c.Mark className="h-10 w-10" />
                  {n > 0 ? (
                    <Badge variant="soft-success" size="sm">
                      {n} key{n === 1 ? '' : 's'}
                    </Badge>
                  ) : (
                    <ArrowUpRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  )}
                </div>
                <span className="mt-3 text-[14px] font-semibold">{c.name}</span>
                <span className="text-muted-foreground mt-1 text-[12.5px] leading-relaxed">
                  {c.blurb}
                </span>
                <span className="text-brand mt-3 text-[12.5px] font-medium">
                  {n > 0 ? 'Add another key' : 'Connect'}
                </span>
              </button>
            );
          })}
        </div>
        <McpConnectDialog
          client={mcp}
          open={mcp !== null}
          onOpenChange={(o) => !o && setMcp(null)}
          appUrl={data.appUrl}
        />
      </section>

      {/* ── CRM ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHead
          title="CRM"
          body="See each person’s iMessage thread on their CRM record, and reply without leaving it."
        />
        <TwentyCard data={data} />
      </section>

      {/* ── Keys ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHead
          title="Your API keys"
          body={
            <>
              Keys act as you. Use them with the MCP server at{' '}
              <code className="text-foreground font-mono">{data.appUrl}/api/mcp</code> or the REST
              API at <code className="text-foreground font-mono">{data.appUrl}/api/v1</code>.
            </>
          }
        />
        <TokenList tokens={data.tokens} />
      </section>

      {/* ── Webhooks ──────────────────────────────────────────────── */}
      {data.canManageWorkspace && (
        <section className="space-y-3">
          <SectionHead
            title="Webhooks"
            body="Comms POSTs a signed JSON event to these URLs when messages come in or go out."
          />
          <WebhookList webhooks={data.webhooks} events={data.webhookEvents} />
        </section>
      )}
    </div>
  );
}

function SectionHead({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">{body}</p>
    </div>
  );
}

/* ── Twenty ─────────────────────────────────────────────────────────── */

function TwentyCard({ data }: { data: IntegrationsData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const t = data.twenty;

  function disconnect() {
    if (!confirm('Disconnect Twenty? Its key is revoked and the webhook removed.')) return;
    start(async () => {
      const res = await disconnectTwenty();
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="bg-card rounded-xl border p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <TwentyMark className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold">Twenty CRM</span>
            {t ? (
              t.lastError ? (
                <Badge variant="soft-warning" size="sm">
                  <CircleAlert className="mr-1 h-3 w-3" /> Delivery failing
                </Badge>
              ) : (
                <Badge variant="soft-success" size="sm">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                </Badge>
              )
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-[12.5px] leading-relaxed">
            {t ? (
              <>
                Connected to{' '}
                <span className="text-foreground font-medium">{new URL(t.url).host}</span>{' '}
                {relativeTime(t.connectedAt)}.{' '}
                {t.lastError
                  ? `Last delivery: ${t.lastError}`
                  : 'New messages update the matching person in Twenty.'}
              </>
            ) : (
              'Adds an iMessage tab to every person in Twenty with their thread and a reply box, and keeps “last texted” up to date as messages arrive.'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {data.canManageWorkspace ? (
            t ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                  Reconnect
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnect} loading={pending}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setOpen(true)}>
                Connect
              </Button>
            )
          ) : (
            <span className="text-muted-foreground text-[12px]">Ask an admin to connect</span>
          )}
        </div>
      </div>
      <TwentyDialog open={open} onOpenChange={setOpen} appRepo={data.twentyAppUrl} />
    </div>
  );
}

function TwentyDialog({
  open,
  onOpenChange,
  appRepo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appRepo: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<{
    apiToken: string;
    webhookSecret: string;
    commsUrl: string;
    webhookUrl: string;
  } | null>(null);
  const [pending, start] = useTransition();

  function close(next: boolean) {
    if (!next) {
      if (result) router.refresh();
      setResult(null);
    }
    onOpenChange(next);
  }

  function connect() {
    start(async () => {
      const res = await connectTwenty({ twentyUrl: url });
      if (res.ok) setResult(res);
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <TwentyMark className="h-10 w-10 shrink-0" />
            <div>
              <DialogTitle>Connect Twenty CRM</DialogTitle>
              <DialogDescription>
                {result
                  ? 'Paste these into the Comms app’s settings in Twenty. The secrets are shown only once.'
                  : 'Comms makes a key for the Twenty app and a webhook that tells it about new messages.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <Steps>
              <li>
                Install the Comms app in your Twenty workspace —{' '}
                <a
                  href={appRepo}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand font-medium hover:underline"
                >
                  setup instructions
                </a>
                .
              </li>
              <li>Enter your Twenty address below and click Connect.</li>
              <li>
                Paste the values you get into <Kbd>Settings → Applications → Comms → Variables</Kbd>{' '}
                in Twenty.
              </li>
            </Steps>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium">Twenty workspace URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://crm.example.com"
                className="bg-background focus:ring-ring/40 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
              />
            </label>
            <div className="flex justify-end">
              <Button onClick={connect} loading={pending} disabled={!url.trim()}>
                Connect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3">
              <CopyField label="COMMS_URL" value={result.commsUrl} />
              <CopyField label="COMMS_API_KEY" value={result.apiToken} secret />
              <CopyField label="COMMS_WEBHOOK_SECRET" value={result.webhookSecret} secret />
            </div>
            <p className="text-muted-foreground text-[12.5px] leading-relaxed">
              Comms will send new messages to{' '}
              <code className="text-foreground break-all font-mono">{result.webhookUrl}</code>. Once
              the variables are saved, open any person in Twenty and look for the iMessage tab.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => close(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Keys ───────────────────────────────────────────────────────────── */

const CLIENT_LABEL: Record<string, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  custom: 'MCP',
  twenty: 'Twenty',
};

function TokenList({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function revoke(t: TokenRow) {
    if (!confirm(`Revoke “${t.name}”? Anything using it stops working immediately.`)) return;
    setBusy(t.id);
    start(async () => {
      const res = await revokeApiToken(t.id);
      setBusy(null);
      if (res.ok) {
        toast.success('Key revoked');
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (tokens.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-3 rounded-xl border border-dashed p-4 text-[13px]">
        <KeyRound className="h-4 w-4 shrink-0" />
        No keys yet. Connecting an assistant above creates one.
      </div>
    );
  }

  return (
    <div className="bg-card divide-y overflow-hidden rounded-xl border shadow-sm">
      {tokens.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[13.5px] font-medium">{t.name}</span>
              {t.client && (
                <Badge variant="outline" size="sm">
                  {CLIENT_LABEL[t.client] ?? t.client}
                </Badge>
              )}
              <Badge variant={t.scopes.includes('write') ? 'soft-warning' : 'secondary'} size="sm">
                {t.scopes.includes('write') ? 'Read & act' : 'Read only'}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-0.5 font-mono text-[11.5px]">
              {t.prefix}•••• · created {relativeTime(t.createdAt)} ·{' '}
              {t.lastUsedAt ? `used ${relativeTime(t.lastUsedAt)}` : 'never used'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => revoke(t)}
            loading={pending && busy === t.id}
          >
            <Trash2 /> Revoke
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ── Webhooks ───────────────────────────────────────────────────────── */

function WebhookList({ webhooks, events }: { webhooks: WebhookRow[]; events: readonly string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', events: ['message.received'] as string[] });

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (success) toast.success(success);
        router.refresh();
      } else toast.error((res as { error: string }).error);
    });
  }

  function add() {
    start(async () => {
      const res = await createWebhook(form);
      if (res.ok) {
        setSecret(res.secret);
        setForm({ name: '', url: '', events: ['message.received'] });
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {webhooks.length > 0 && (
        <div className="bg-card divide-y overflow-hidden rounded-xl border shadow-sm">
          {webhooks.map((w) => {
            const failing = Boolean(w.lastError);
            return (
              <div key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    !w.enabled ? 'bg-muted-foreground/40' : failing ? 'bg-warning' : 'bg-success',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium">{w.name}</span>
                    {w.client === 'twenty' && (
                      <Badge variant="outline" size="sm">
                        Twenty
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground truncate font-mono text-[11.5px]">
                    {w.url}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[11.5px]">
                    {w.events.join(', ')}
                    {w.lastDeliveryAt &&
                      ` · last delivery ${relativeTime(w.lastDeliveryAt)}${w.lastStatus ? ` (HTTP ${w.lastStatus})` : ''}`}
                    {w.lastError && <span className="text-warning"> · {w.lastError}</span>}
                    {!w.enabled && w.failureCount > 0 && ' · switched off after repeated failures'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={w.enabled}
                    onCheckedChange={(v) => run(() => setWebhookEnabled(w.id, v))}
                    aria-label="Enabled"
                  />
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => run(() => testWebhook(w.id), 'Ping delivered')}
                    disabled={pending}
                  >
                    <Zap /> Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => confirm(`Delete “${w.name}”?`) && run(() => deleteWebhook(w.id))}
                    aria-label="Delete webhook"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {secret ? (
        <div className="bg-card space-y-3 rounded-xl border p-4 shadow-sm">
          <p className="text-[13px]">
            Webhook added. Verify each delivery’s <code className="font-mono">Comms-Signature</code>{' '}
            header with this secret — it won’t be shown again.
          </p>
          <CopyField label="Signing secret" value={secret} secret />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setSecret(null)}>
              Done
            </Button>
          </div>
        </div>
      ) : adding ? (
        <div className="bg-card space-y-3 rounded-xl border p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name"
              className="bg-background focus:ring-ring/40 h-9 rounded-lg border px-3 text-sm outline-none focus:ring-2"
            />
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/hooks/comms"
              className="bg-background focus:ring-ring/40 h-9 rounded-lg border px-3 font-mono text-[13px] outline-none focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {events.map((e) => {
              const on = form.events.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setForm({
                      ...form,
                      events: on ? form.events.filter((x) => x !== e) : [...form.events, e],
                    })
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-mono text-[11.5px] transition',
                    on
                      ? 'border-brand/50 bg-brand-muted text-brand'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {e}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={add} loading={pending} disabled={!form.url.trim()}>
              Add webhook
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          {webhooks.length ? <Plus /> : <Webhook />} Add webhook
        </Button>
      )}
    </div>
  );
}
