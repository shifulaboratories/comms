'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  Star,
  ChevronRight,
  Check,
  Pencil,
  Plus,
  UsersRound,
  X,
  Brain,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateConversation, toggleTag } from '@/server/actions/inbox';
import { createAndApplyTag } from '@/server/actions/views';
import { renameInbox } from '@/server/actions/inboxes';
import { setContactAttribute, updateContactDetails } from '@/server/actions/contacts';
import { undoToast } from '@/lib/undo';
import { relativeTime } from '@/lib/format';
import { formatAddress } from '@/lib/naming';
import { PersonCard, type PersonCardProps } from '@/components/inbox/person-card';
import { cn, initials } from '@/lib/utils';
import { MemoryPanel, type MemoryData } from '@/components/inbox/memory-panel';

const UNASSIGNED = '__unassigned__';

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'bg-success-muted text-success',
  negative: 'bg-destructive-muted text-destructive',
  neutral: 'bg-secondary text-muted-foreground',
};

function Section({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <section className="border-border-strong border-t border-dashed px-4 py-3.5 first:border-t-0">
      <p className="type-micro text-muted-foreground/70 mb-2.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      {children}
    </section>
  );
}

/**
 * A section you can fold away. Used for the ticket controls, which are
 * administration rather than context — a personal user never opens them, and a
 * support user opens them once per conversation, not every time they look.
 */
function CollapsibleSection({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-border-strong border-t border-dashed px-4 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="type-micro text-muted-foreground/70 hover:text-foreground flex w-full items-center gap-1.5 transition-colors"
      >
        <ChevronRight
          className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-90')}
        />
        {label}
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground shrink-0 text-[12.5px]">{label}</span>
      <div className="w-[58%]">{children}</div>
    </div>
  );
}

export function TicketPanel({
  conversation,
  agents,
  allTags,
  ai,
  sla,
  person,
  participants = [],
  contact,
  canManageTags = false,
  canRenameInbox = false,
  memory,
}: {
  conversation: {
    id: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    contactName: string;
    contactIdentities: string[];
    inboxId: string;
    inboxName: string;
    tagIds: string[];
    isGroup: boolean;
  };
  /** Who you are talking to — rendered above the workflow controls. */
  person?: PersonCardProps | null;
  /** Everyone in a group thread — a group is its members, not one number. */
  participants?: {
    contactId: string | null;
    name: string | null;
    address: string;
    rawAddress: string | null;
    avatarUrl: string | null;
  }[];
  /** The linked contact's trackable facts (notes, company, custom fields). */
  contact?: {
    id: string;
    notes: string | null;
    company: string | null;
    attributes: Record<string, string>;
  } | null;
  /** workspace.manage — the create-tag affordance follows the settings page. */
  canManageTags?: boolean;
  /** inboxes.manage — renaming the number is an inbox-level act. */
  canRenameInbox?: boolean;
  /** Facts and session summaries the AI keeps; omitted where AI is off. */
  memory?: MemoryData;
  agents: { id: string; name: string | null; email: string }[];
  allTags: { id: string; name: string; color: string }[];
  ai?: { summary?: string; topic?: string; sentiment?: string } | null;
  sla?: {
    nextResponseDueAt: Date | string | null;
    slaBreachedAt: Date | string | null;
    csatScore: number | null;
  } | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const pending = false; // controls stay interactive — updates are optimistic

  // Optimistic local copies of every editable field: the control flips
  // instantly, the server action runs in the background, failures revert.
  // Server props re-sync after router.refresh (SSE-driven or explicit).
  const [status, setStatus] = useState(conversation.status);
  const [priority, setPriority] = useState(conversation.priority);
  const [assigneeId, setAssigneeId] = useState(conversation.assigneeId);
  const [tagIds, setTagIds] = useState<string[]>(conversation.tagIds);
  useEffect(() => setStatus(conversation.status), [conversation.status]);
  useEffect(() => setPriority(conversation.priority), [conversation.priority]);
  useEffect(() => setAssigneeId(conversation.assigneeId), [conversation.assigneeId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setTagIds(conversation.tagIds), [conversation.tagIds.join(',')]);

  function optimistic(
    apply: () => void,
    revert: () => void,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    /** When present, success shows the standard undo toast running `inverse`. */
    undo?: { label: string; inverse: () => Promise<{ ok: boolean; error?: string }> },
  ) {
    apply();
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        revert();
        toast.error(res.error ?? 'Something went wrong');
      } else {
        if (undo) {
          undoToast(undo.label, undo.inverse, {
            onUndone: () => {
              revert();
              router.refresh();
            },
          });
        }
        router.refresh();
      }
    });
  }

  const showSla = Boolean(sla?.slaBreachedAt || sla?.nextResponseDueAt || sla?.csatScore != null);

  return (
    // Width, border and scrolling are owned by the DetailsPane that hosts this.
    <div className="flex flex-col">
      {person ? (
        <PersonCard {...person} />
      ) : (
        <div className="flex flex-col items-center gap-2.5 px-4 py-5 text-center">
          <Avatar className="ring-border h-14 w-14 ring-1">
            <AvatarFallback className="text-base font-semibold">
              {initials(conversation.contactName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="type-title truncate">{conversation.contactName}</p>
            <p className="type-body text-muted-foreground truncate">
              {conversation.contactIdentities[0] ?? 'No contact info'}
            </p>
          </div>
        </div>
      )}

      {/* A group IS its members. One phone number for a five-person thread
          answered "who am I talking to" with a lie of omission. */}
      {conversation.isGroup && participants.length > 0 && (
        <Section label={`Members · ${participants.length}`} icon={UsersRound}>
          <div className="space-y-1.5">
            {participants.map((m) => {
              const display = m.name || formatAddress(m.rawAddress ?? m.address) || m.address;
              const sub = m.name ? (formatAddress(m.rawAddress ?? m.address) ?? m.address) : null;
              const body = (
                <>
                  <Avatar className="ring-border h-7 w-7 ring-1">
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                    <AvatarFallback className="text-[10px] font-semibold">
                      {initials(display)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{display}</p>
                    {sub && (
                      <p className="text-muted-foreground truncate font-mono text-[10.5px]">
                        {sub}
                      </p>
                    )}
                  </div>
                  {!m.name && (
                    <span className="type-caption text-muted-foreground/60 shrink-0">unknown</span>
                  )}
                </>
              );

              // A member with no contact row is just an address we've seen in
              // this chat — there is no page to open, so it stays inert
              // rather than offering a link that 404s.
              return m.contactId ? (
                <Link
                  key={m.address}
                  href={`/people/${m.contactId}`}
                  className="hover:bg-accent -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors"
                >
                  {body}
                </Link>
              ) : (
                <div key={m.address} className="flex items-center gap-2.5">
                  {body}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {ai?.summary && (
        <Section label="AI summary" icon={Sparkles}>
          <div className="border-brand-border/50 bg-brand-muted/60 rounded-lg border p-2.5">
            <p className="text-[12.5px] leading-relaxed">{ai.summary}</p>
            {(ai.topic || ai.sentiment) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ai.topic && (
                  <span className="bg-surface/70 rounded-md px-1.5 py-px text-[11px] font-medium">
                    {ai.topic}
                  </span>
                )}
                {ai.sentiment && (
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-px text-[11px] font-medium capitalize',
                      SENTIMENT_STYLE[ai.sentiment] ?? 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {ai.sentiment}
                  </span>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      <CollapsibleSection label="Ticket" defaultOpen={false}>
        <div className="space-y-2.5">
          <Field label="Assignee">
            <Select
              value={assigneeId ?? UNASSIGNED}
              onValueChange={(v) => {
                const prev = assigneeId;
                const next = v === UNASSIGNED ? null : v;
                optimistic(
                  () => setAssigneeId(next),
                  () => setAssigneeId(prev),
                  () => updateConversation({ id: conversation.id, assigneeId: next }),
                  {
                    label: next ? 'Assignee changed' : 'Unassigned',
                    inverse: () => updateConversation({ id: conversation.id, assigneeId: prev }),
                  },
                );
              }}
              disabled={pending}
            >
              <SelectTrigger className="h-8 text-[12.5px]">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name ?? a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={status}
              onValueChange={(v) => {
                const prev = status;
                optimistic(
                  () => setStatus(v),
                  () => setStatus(prev),
                  () =>
                    updateConversation({
                      id: conversation.id,
                      status: v as 'open' | 'pending' | 'snoozed' | 'closed',
                    }),
                  {
                    label: `Marked ${v}`,
                    inverse: () =>
                      updateConversation({
                        id: conversation.id,
                        status: prev as 'open' | 'pending' | 'snoozed' | 'closed',
                      }),
                  },
                );
              }}
              disabled={pending}
            >
              <SelectTrigger className="h-8 text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="snoozed">Snoozed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Priority">
            <Select
              value={priority}
              onValueChange={(v) => {
                const prev = priority;
                optimistic(
                  () => setPriority(v),
                  () => setPriority(prev),
                  () =>
                    updateConversation({
                      id: conversation.id,
                      priority: v as 'low' | 'normal' | 'high' | 'urgent',
                    }),
                  {
                    label: `Priority set to ${v}`,
                    inverse: () =>
                      updateConversation({
                        id: conversation.id,
                        priority: prev as 'low' | 'normal' | 'high' | 'urgent',
                      }),
                  },
                );
              }}
              disabled={pending}
            >
              <SelectTrigger className="h-8 text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </CollapsibleSection>

      <Section label="Tags">
        {allTags.length === 0 && !canManageTags ? (
          <p className="text-muted-foreground text-[12px]">
            No tags yet — an admin can create them here or in Settings → Tags.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => {
              const active = tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  disabled={pending}
                  onClick={() => {
                    const prev = tagIds;
                    optimistic(
                      () => setTagIds(active ? prev.filter((id) => id !== t.id) : [...prev, t.id]),
                      () => setTagIds(prev),
                      () => toggleTag(conversation.id, t.id),
                    );
                  }}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-[11.5px] font-medium transition-all duration-150 active:scale-95',
                    active
                      ? 'border-transparent'
                      : 'border-border text-muted-foreground hover:border-border-strong hover:bg-accent',
                  )}
                  style={active ? { backgroundColor: `${t.color}20`, color: t.color } : undefined}
                >
                  {t.name}
                </button>
              );
            })}
            {/* Create-and-apply, right where the need appears. */}
            {canManageTags && (
              <TagCreator
                conversationId={conversation.id}
                onCreated={(tagId) => {
                  setTagIds((prev) => [...prev, tagId]);
                  router.refresh();
                }}
              />
            )}
          </div>
        )}
      </Section>

      {contact && (
        <Section label="Notes" icon={Pencil}>
          <ContactNotes contactId={contact.id} initial={contact.notes} />
        </Section>
      )}

      {memory && (
        <Section label="Memory" icon={Brain}>
          <MemoryPanel contactId={contact?.id ?? null} memory={memory} />
        </Section>
      )}

      {contact && (
        <Section label="Details">
          <ContactFields
            contactId={contact.id}
            company={contact.company}
            attributes={contact.attributes}
          />
        </Section>
      )}

      {showSla && (
        <Section label="Service level">
          <div className="space-y-2">
            {sla!.slaBreachedAt ? (
              <div className="border-destructive/25 bg-destructive-muted text-destructive flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Response overdue
              </div>
            ) : sla!.nextResponseDueAt ? (
              <div className="bg-secondary/50 text-muted-foreground flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px]">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Due <span className="text-foreground">{relativeTime(sla!.nextResponseDueAt)}</span>
              </div>
            ) : null}
            {sla!.csatScore != null && (
              <div className="text-muted-foreground flex items-center gap-1.5 px-0.5 text-[12px]">
                <span>Rating</span>
                <span className="ml-auto flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        'h-3 w-3',
                        n <= sla!.csatScore!
                          ? 'fill-warning text-warning'
                          : 'text-muted-foreground/30',
                      )}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section label="Channel">
        <ChannelName
          inboxId={conversation.inboxId}
          name={conversation.inboxName}
          canRename={canRenameInbox}
        />
      </Section>
    </div>
  );
}

/** Inline "+ tag" that creates AND applies — no settings round-trip. */
function TagCreator({
  conversationId,
  onCreated,
}: {
  conversationId: string;
  onCreated: (tagId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await createAndApplyTag({ conversationId, name: trimmed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tagged "${trimmed}"`);
      setName('');
      setEditing(false);
      onCreated(res.tagId);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="border-border-strong text-muted-foreground hover:border-brand/40 hover:text-brand flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[11.5px] font-medium transition-colors"
      >
        <Plus className="h-3 w-3" />
        New tag
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={submit}
        disabled={pending}
        placeholder="tag name"
        className="focus:border-brand/50 w-24 rounded-md border bg-transparent px-2 py-0.5 text-[11.5px] outline-none"
      />
    </span>
  );
}

/** The channel's display name, renamable in place. "iMessage" is a default, not an identity. */
function ChannelName({
  inboxId,
  name,
  canRename,
}: {
  inboxId: string;
  name: string;
  canRename: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  useEffect(() => setValue(name), [name]);

  function submit() {
    const trimmed = value.trim();
    setEditing(false);
    if (!trimmed || trimmed === name) {
      setValue(name);
      return;
    }
    start(async () => {
      const res = await renameInbox(inboxId, trimmed);
      if (!res.ok) {
        setValue(name);
        toast.error('error' in res ? res.error : 'Could not rename');
        return;
      }
      toast.success(`Number renamed to "${trimmed}"`);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setValue(name);
            setEditing(false);
          }
        }}
        onBlur={submit}
        disabled={pending}
        maxLength={60}
        className="focus:border-brand/50 w-full rounded-md border bg-transparent px-2 py-1 text-[12.5px] outline-none"
      />
    );
  }

  return (
    <div className="group/chan flex items-center gap-1.5">
      <p className="min-w-0 flex-1 truncate text-[12.5px]">{name}</p>
      {canRename && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Rename this number"
          title="Rename this number"
          className="text-muted-foreground/50 hover:text-foreground rounded p-1 opacity-0 transition-all group-hover/chan:opacity-100"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Notes on the person — saved on blur, shared with the whole team. */
function ContactNotes({ contactId, initial }: { contactId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? '');
  const [saved, setSaved] = useState<string>(initial ?? '');
  const [, start] = useTransition();

  function save() {
    if (value === saved) return;
    const next = value;
    start(async () => {
      const res = await updateContactDetails({ contactId, notes: next });
      if (res.ok) {
        setSaved(next);
        toast.success('Notes saved', { duration: 1500 });
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      rows={3}
      maxLength={4000}
      placeholder="Anything the next teammate should know about this person…"
      className="placeholder:text-muted-foreground/60 focus:border-brand/50 w-full resize-none rounded-lg border bg-transparent px-2.5 py-2 text-[12.5px] leading-relaxed outline-none transition-colors"
    />
  );
}

/** Company + custom key/value fields — the trackable facts of a client. */
function ContactFields({
  contactId,
  company: initialCompany,
  attributes,
}: {
  contactId: string;
  company: string | null;
  attributes: Record<string, string>;
}) {
  const router = useRouter();
  const [company, setCompany] = useState(initialCompany ?? '');
  const [savedCompany, setSavedCompany] = useState(initialCompany ?? '');
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [pending, start] = useTransition();

  function saveCompany() {
    if (company === savedCompany) return;
    const next = company;
    start(async () => {
      const res = await updateContactDetails({ contactId, company: next });
      if (res.ok) setSavedCompany(next);
      else toast.error(res.error);
    });
  }

  function addField() {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key || !value) return;
    start(async () => {
      const res = await setContactAttribute({ contactId, key, value });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAdding(false);
      setNewKey('');
      setNewValue('');
      router.refresh();
    });
  }

  function removeField(key: string) {
    start(async () => {
      const res = await setContactAttribute({ contactId, key, value: '' });
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground shrink-0 text-[12px]">Company</span>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onBlur={saveCompany}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          maxLength={120}
          placeholder="—"
          className="hover:border-border focus:border-brand/50 w-[58%] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[12.5px] outline-none transition-colors focus:text-left"
        />
      </div>

      {Object.entries(attributes).map(([key, value]) => (
        <div key={key} className="group/attr flex items-center justify-between gap-3">
          <span className="text-muted-foreground min-w-0 shrink-0 truncate text-[12px]">{key}</span>
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[12.5px]">{value}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => removeField(key)}
              aria-label={`Remove ${key}`}
              className="text-muted-foreground/50 hover:text-destructive rounded p-0.5 opacity-0 transition-all group-hover/attr:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Field"
            maxLength={40}
            className="focus:border-brand/50 w-2/5 rounded-md border bg-transparent px-2 py-1 text-[12px] outline-none"
          />
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addField()}
            placeholder="Value"
            maxLength={500}
            className="focus:border-brand/50 min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-[12px] outline-none"
          />
          <button
            type="button"
            onClick={addField}
            disabled={pending || !newKey.trim() || !newValue.trim()}
            aria-label="Save field"
            className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-muted-foreground hover:text-brand flex items-center gap-1 text-[11.5px] font-medium transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add field
        </button>
      )}
    </div>
  );
}
