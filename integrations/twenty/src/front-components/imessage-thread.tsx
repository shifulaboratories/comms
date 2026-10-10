import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  useColorScheme,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { useCallback, useEffect, useRef, useState } from 'react';

import { FRONT_THREAD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type { ThreadResult } from 'src/logic-functions/get-thread';
import type { SendResult } from 'src/logic-functions/send-message';
import type { CommsMessage } from 'src/lib/comms';

/**
 * The iMessage tab on a person: their thread from Comms, live, with a reply
 * box. Data comes through this app's own routes, so the Comms key never
 * reaches the browser.
 */

const palette = (dark: boolean) => ({
  text: dark ? '#ebebeb' : '#1f1f1f',
  muted: dark ? '#8a8a8a' : '#6b6b6b',
  border: dark ? '#2e2e2e' : '#e6e6e6',
  surface: dark ? '#171717' : '#ffffff',
  sunken: dark ? '#1f1f1f' : '#f6f6f6',
  them: dark ? '#2b2b2b' : '#e9e9eb',
  me: '#2f7bf6',
  note: dark ? '#3a3220' : '#fff6db',
  danger: '#e5484d',
});

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
};
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

const STATUS_COLOR: Record<string, string> = {
  open: '#2f9e44',
  pending: '#f08c00',
  snoozed: '#7048e8',
  closed: '#868e96',
};

const ImessageThread = () => {
  const [personId] = useSelectedRecordIds();
  const dark = useColorScheme() === 'dark';
  const c = palette(dark);
  const [state, setState] = useState<ThreadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (conversationId?: string) => {
      if (!personId) return;
      setLoading(true);
      try {
        const res = await new RestApiClient().post<ThreadResult>(
          '/s/comms/thread',
          {
            personId,
            conversationId,
          },
        );
        setState(res);
      } catch {
        setState({
          status: 'error',
          message: 'Could not load the conversation.',
        });
      } finally {
        setLoading(false);
      }
    },
    [personId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [state]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !personId || sending) return;
    setSending(true);
    try {
      const res = await new RestApiClient().post<SendResult>('/s/comms/send', {
        personId,
        conversationId:
          state?.status === 'ok' ? state.conversation.id : undefined,
        body,
      });
      if (res.ok) {
        setDraft('');
        await enqueueSnackbar({
          message: res.undoSeconds
            ? `Sending in ${res.undoSeconds}s — it can still be undone in Comms`
            : 'Message sent',
          variant: 'success',
        });
        await load(res.conversationId);
      } else {
        await enqueueSnackbar({ message: res.message, variant: 'error' });
      }
    } catch {
      await enqueueSnackbar({
        message: 'Could not reach Comms.',
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 420,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: c.text,
    background: c.surface,
  };

  if (!state && loading) {
    return (
      <div
        style={{
          ...shell,
          alignItems: 'center',
          justifyContent: 'center',
          color: c.muted,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!state || state.status === 'error' || state.status === 'not_configured') {
    return (
      <Empty
        c={c}
        title={
          state?.status === 'not_configured'
            ? 'Connect Comms'
            : 'Something went wrong'
        }
      >
        {state && 'message' in state
          ? state.message
          : 'Could not load the conversation.'}
        {state?.status === 'not_configured' && (
          <>
            {' '}
            <a href="/settings/applications#installed" style={{ color: c.me }}>
              Open app settings
            </a>
          </>
        )}
      </Empty>
    );
  }

  if (state.status === 'no_address') {
    return (
      <Empty c={c} title="No phone number or email">
        Add a phone number to {state.personName || 'this person'} to text them
        from here.
      </Empty>
    );
  }

  const messages: CommsMessage[] = state.status === 'ok' ? state.messages : [];
  const conversation = state.status === 'ok' ? state.conversation : null;
  const optedOut = state.contact?.optedOut;

  return (
    <div style={shell}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderBottom: `1px solid ${c.border}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>
            {conversation?.title ?? state.personName}
          </div>
          <div style={{ color: c.muted, fontSize: 12 }}>
            {conversation ? (
              <>
                <span
                  style={{
                    color: STATUS_COLOR[conversation.status] ?? c.muted,
                  }}
                >
                  ●
                </span>{' '}
                {conversation.status}
                {conversation.assignee
                  ? ` · ${conversation.assignee.name ?? conversation.assignee.email}`
                  : ' · unassigned'}
                {state.status === 'ok' &&
                  state.otherConversations.length > 0 &&
                  ` · ${state.otherConversations.length} other thread${state.otherConversations.length === 1 ? '' : 's'}`}
              </>
            ) : (
              `No conversation yet with ${state.status === 'no_conversation' ? state.address : ''}`
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(conversation?.id)}
          style={btn(c, false)}
          disabled={loading}
        >
          {loading ? '…' : 'Refresh'}
        </button>
        {conversation && (
          <a
            href={conversation.url}
            target="_blank"
            rel="noreferrer"
            style={{ ...btn(c, false), textDecoration: 'none' }}
          >
            Open in Comms ↗
          </a>
        )}
      </div>

      {/* Thread */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          background: c.sunken,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>
            No messages yet. Say hello below.
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay =
              !prev ||
              new Date(prev.createdAt).toDateString() !==
                new Date(m.createdAt).toDateString();
            const mine = m.direction === 'outbound';
            return (
              <div key={m.id}>
                {newDay && (
                  <div
                    style={{
                      textAlign: 'center',
                      color: c.muted,
                      fontSize: 11,
                      margin: '12px 0 8px',
                    }}
                  >
                    {dayLabel(m.createdAt)}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    margin: '3px 0',
                  }}
                >
                  <div
                    title={`${m.author.name ?? ''} · ${timeLabel(m.createdAt)}`}
                    style={{
                      maxWidth: '75%',
                      padding: '7px 11px',
                      borderRadius: 16,
                      borderBottomRightRadius: mine ? 4 : 16,
                      borderBottomLeftRadius: mine ? 16 : 4,
                      background:
                        m.kind === 'note' ? c.note : mine ? c.me : c.them,
                      color:
                        m.kind === 'note' ? c.text : mine ? '#fff' : c.text,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.4,
                      opacity:
                        m.status === 'queued' || m.status === 'sending'
                          ? 0.7
                          : 1,
                    }}
                  >
                    {m.body}
                  </div>
                </div>
                {(i === messages.length - 1 ||
                  messages[i + 1]?.direction !== m.direction) && (
                  <div
                    style={{
                      textAlign: mine ? 'right' : 'left',
                      color: m.status === 'failed' ? c.danger : c.muted,
                      fontSize: 11,
                      margin: '0 4px 6px',
                    }}
                  >
                    {mine && m.author.name ? `${m.author.name} · ` : ''}
                    {timeLabel(m.createdAt)}
                    {m.status === 'failed'
                      ? ' · not delivered'
                      : m.status === 'queued'
                        ? ' · sending'
                        : ''}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      {/* Composer */}
      <div style={{ padding: 10, borderTop: `1px solid ${c.border}` }}>
        {optedOut ? (
          <div style={{ color: c.muted, fontSize: 12, padding: 6 }}>
            This person replied STOP. Comms won’t message them until they reply
            START.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="iMessage"
              style={{
                flex: 1,
                resize: 'none',
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                padding: '8px 12px',
                fontFamily: 'inherit',
                fontSize: 13,
                color: c.text,
                background: c.surface,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              style={{
                ...btn(c, true),
                opacity: !draft.trim() || sending ? 0.5 : 1,
              }}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function btn(
  c: ReturnType<typeof palette>,
  primary: boolean,
): React.CSSProperties {
  return {
    border: primary ? 'none' : `1px solid ${c.border}`,
    background: primary ? c.me : c.surface,
    color: primary ? '#fff' : c.text,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function Empty({
  c,
  title,
  children,
}: {
  c: ReturnType<typeof palette>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 40,
        minHeight: 240,
        textAlign: 'center',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: c.text,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
      <div
        style={{ color: c.muted, fontSize: 13, maxWidth: 360, lineHeight: 1.5 }}
      >
        {children}
      </div>
    </div>
  );
}

export default defineFrontComponent({
  universalIdentifier: FRONT_THREAD_UNIVERSAL_IDENTIFIER,
  name: 'imessage-thread',
  description:
    "This person's iMessage conversation from Comms, with a reply box.",
  component: ImessageThread,
});
