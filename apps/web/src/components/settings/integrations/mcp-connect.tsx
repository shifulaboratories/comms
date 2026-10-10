'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, KeyRound, ShieldCheck, Send } from 'lucide-react';
import { createApiToken } from '@/server/actions/integrations';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CodeBlock, CopyField, Kbd, Steps } from './shared';
import { ClaudeMark, McpMark, OpenAIMark } from './logos';

export type McpClient = 'claude' | 'openai' | 'custom';

export const MCP_CLIENTS: {
  id: McpClient;
  name: string;
  blurb: string;
  Mark: (p: { className?: string }) => React.ReactElement;
}[] = [
  {
    id: 'claude',
    name: 'Claude',
    blurb:
      'Ask Claude about your conversations and have it draft or send replies — in Claude, Claude Code or the API.',
    Mark: ClaudeMark,
  },
  {
    id: 'openai',
    name: 'ChatGPT & OpenAI',
    blurb: 'Use your inbox from ChatGPT, Codex, or the OpenAI Responses API.',
    Mark: OpenAIMark,
  },
  {
    id: 'custom',
    name: 'Custom MCP client',
    blurb: 'Any app that speaks the Model Context Protocol: Cursor, VS Code, your own agent.',
    Mark: McpMark,
  },
];

/**
 * Connect an AI assistant over MCP: name a key, choose what it may do, then
 * get setup steps for that assistant with the key already filled in. The key
 * is shown only here, once.
 */
export function McpConnectDialog({
  client,
  open,
  onOpenChange,
  appUrl,
}: {
  client: McpClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUrl: string;
}) {
  const router = useRouter();
  const meta = MCP_CLIENTS.find((c) => c.id === client) ?? MCP_CLIENTS[2]!;
  const [access, setAccess] = useState<'read' | 'write'>('read');
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset(next: boolean) {
    if (!next) {
      setToken(null);
      setName('');
      setAccess('read');
      if (token) router.refresh();
    }
    onOpenChange(next);
  }

  function create() {
    start(async () => {
      const res = await createApiToken({
        name: name.trim() || meta.name,
        client: meta.id,
        access,
      });
      if (res.ok) setToken(res.token);
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <meta.Mark className="h-10 w-10 shrink-0" />
            <div>
              <DialogTitle>Connect {meta.name}</DialogTitle>
              <DialogDescription>
                {token
                  ? 'Your key is ready. Copy it now — it won’t be shown again.'
                  : 'Comms runs an MCP server. Give it a key and pick what it’s allowed to do.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!token ? (
          <div className="space-y-5">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium">Key name</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${meta.name} on my laptop`}
                className="bg-background focus:ring-ring/40 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-[13px] font-medium">Access</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <AccessOption
                  active={access === 'read'}
                  onClick={() => setAccess('read')}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Read only"
                  body="Search, read conversations and look up people. Can’t send anything."
                />
                <AccessOption
                  active={access === 'write'}
                  onClick={() => setAccess('write')}
                  icon={<Send className="h-4 w-4" />}
                  title="Read & act"
                  body="Also send replies, add notes, and assign or close conversations — as you."
                />
              </div>
            </div>

            <p className="text-muted-foreground text-[12.5px] leading-relaxed">
              The key acts as you: it sees what you see and anything it sends goes out under your
              name. Verification-code threads are never shared. Revoke it here at any time.
            </p>

            <div className="flex justify-end">
              <Button onClick={create} loading={pending}>
                <KeyRound className="h-4 w-4" /> Create key <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <SetupSteps client={meta.id} token={token} appUrl={appUrl} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccessOption({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-xl border p-3 text-left transition',
        active
          ? 'border-brand/60 bg-brand-muted/50 ring-brand/20 ring-2'
          : 'hover:border-border-strong hover:bg-accent/40',
      )}
    >
      <span
        className={cn('flex items-center gap-2 text-[13px] font-medium', active && 'text-brand')}
      >
        {icon}
        {title}
      </span>
      <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">{body}</span>
    </button>
  );
}

function SetupSteps({
  client,
  token,
  appUrl,
}: {
  client: McpClient;
  token: string;
  appUrl: string;
}) {
  const endpoint = `${appUrl}/api/mcp`;
  const keyUrl = `${appUrl}/api/mcp/k/${token}`;

  const keyFields = (
    <div className="grid gap-3">
      <CopyField label="Server URL" value={endpoint} />
      <CopyField label="API key" value={token} secret hint="Authorization: Bearer …" />
    </div>
  );
  const urlOnly = (
    <CopyField
      label="Connector URL (includes your key)"
      value={keyUrl}
      secret
      masked={`${endpoint}/k/${token.slice(0, 8)}${'•'.repeat(16)}`}
      hint="Treat it like a password"
    />
  );

  if (client === 'claude') {
    return (
      <Tabs defaultValue="app" className="space-y-4">
        <TabsList>
          <TabsTrigger value="app">Claude app</TabsTrigger>
          <TabsTrigger value="code">Claude Code</TabsTrigger>
          <TabsTrigger value="api">Claude API</TabsTrigger>
        </TabsList>
        <TabsContent value="app" className="space-y-4">
          {urlOnly}
          <Steps>
            <li>
              In Claude (web or desktop), open <Kbd>Settings → Connectors</Kbd>.
            </li>
            <li>
              Click <Kbd>Add custom connector</Kbd>, name it <Kbd>Comms</Kbd>, and paste the URL
              above. Leave the OAuth fields empty.
            </li>
            <li>
              In a chat, turn Comms on from the tools menu and ask something like “What came in
              overnight that still needs a reply?”
            </li>
          </Steps>
        </TabsContent>
        <TabsContent value="code" className="space-y-4">
          <CodeBlock
            label="Terminal"
            code={`claude mcp add --transport http comms ${endpoint} \\\n  --header "Authorization: Bearer ${token}"`}
          />
          <p className="text-muted-foreground text-[12.5px]">
            Add <code className="font-mono">--scope user</code> to use it in every project.
          </p>
        </TabsContent>
        <TabsContent value="api" className="space-y-4">
          <CodeBlock
            label="Python"
            code={`import anthropic

client = anthropic.Anthropic()

response = client.beta.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,
    betas=["mcp-client-2025-11-20"],
    mcp_servers=[{
        "type": "url",
        "url": "${endpoint}",
        "name": "comms",
        "authorization_token": "${token}",
    }],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "comms"}],
    messages=[{"role": "user", "content": "Summarize today's open conversations."}],
)`}
          />
        </TabsContent>
      </Tabs>
    );
  }

  if (client === 'openai') {
    return (
      <Tabs defaultValue="chatgpt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
          <TabsTrigger value="api">Responses API</TabsTrigger>
          <TabsTrigger value="codex">Codex</TabsTrigger>
        </TabsList>
        <TabsContent value="chatgpt" className="space-y-4">
          {urlOnly}
          <Steps>
            <li>
              In ChatGPT, open <Kbd>Settings → Apps & Connectors → Advanced settings</Kbd> and turn
              on <Kbd>Developer mode</Kbd>.
            </li>
            <li>
              Back in <Kbd>Apps & Connectors</Kbd>, click <Kbd>Create</Kbd>. Name it{' '}
              <Kbd>Comms</Kbd>, paste the URL above, and choose <Kbd>No authentication</Kbd> — the
              key is already in the URL.
            </li>
            <li>Start a chat, add Comms from the tools menu, and ask away.</li>
          </Steps>
        </TabsContent>
        <TabsContent value="api" className="space-y-4">
          <CodeBlock
            label="Python"
            code={`from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    tools=[{
        "type": "mcp",
        "server_label": "comms",
        "server_url": "${endpoint}",
        "headers": {"Authorization": "Bearer ${token}"},
        "require_approval": "always",
    }],
    input="Summarize today's open conversations.",
)`}
          />
          <p className="text-muted-foreground text-[12.5px]">
            <code className="font-mono">require_approval: &quot;always&quot;</code> makes your code
            confirm each tool call — recommended for a key that can send messages.
          </p>
        </TabsContent>
        <TabsContent value="codex" className="space-y-4">
          <CodeBlock
            label="~/.codex/config.toml"
            code={`[mcp_servers.comms]
url = "${endpoint}"
bearer_token_env_var = "COMMS_API_KEY"`}
          />
          <CodeBlock label="Shell" code={`export COMMS_API_KEY="${token}"`} />
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="space-y-4">
      {keyFields}
      <CodeBlock
        label="mcp.json (Cursor, VS Code, Windsurf and most clients)"
        code={JSON.stringify(
          {
            mcpServers: {
              comms: { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${token}` } },
            },
          },
          null,
          2,
        )}
      />
      <p className="text-muted-foreground text-[12.5px] leading-relaxed">
        Streamable HTTP, stateless, JSON responses. For a client that only takes a URL, use{' '}
        <code className="break-all font-mono">{`${appUrl}/api/mcp/k/<key>`}</code> instead.
      </p>
      <CodeBlock
        label="Check it works"
        code={`curl -s ${endpoint} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
      />
    </div>
  );
}
