'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Sparkles, User, X } from 'lucide-react';
import { addContactFact, deleteContactFact } from '@/server/actions/contacts';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export type MemoryData = {
  facts: { id: string; key: string; value: string; source: 'ai' | 'human'; learnedAt: string }[];
  sessions: { id: string; endedAt: string; messageCount: number; summary: string }[];
};

/**
 * What the AI remembers, shown where it can be checked and corrected.
 *
 * Facts carry where they came from and how old they are, because a fact the
 * team cannot see is a fact nobody can fix — and the AI quotes them back when
 * drafting. A fact added by hand is never overwritten by the model.
 */
export function MemoryPanel({
  contactId,
  memory,
}: {
  contactId: string | null;
  memory: MemoryData;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  function add() {
    if (!contactId) return;
    start(async () => {
      const res = await addContactFact({ contactId, key, value });
      if (res.ok) {
        setKey('');
        setValue('');
        setAdding(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(factId: string) {
    start(async () => {
      const res = await deleteContactFact({ factId });
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  const empty = memory.facts.length === 0 && memory.sessions.length === 0;

  return (
    <div className="space-y-3 text-[12.5px]">
      {contactId && (
        <div className="space-y-1">
          {memory.facts.map((f) => (
            <div
              key={f.id}
              className="hover:bg-accent/50 group flex items-start gap-2 rounded-lg px-1.5 py-1 transition-colors"
            >
              <span
                className="text-muted-foreground mt-0.5 shrink-0"
                title={f.source === 'ai' ? 'Learned by AI' : 'Added by a teammate'}
              >
                {f.source === 'ai' ? (
                  <Sparkles className="h-3 w-3" />
                ) : (
                  <User className="h-3 w-3" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground">{f.key.replace(/_/g, ' ')}</span>{' '}
                <span className="font-medium">{f.value}</span>
                <span className="text-muted-foreground/70 block text-[11px]">
                  {relativeTime(f.learnedAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(f.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Forget ${f.key.replace(/_/g, ' ')}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {adding ? (
            <form
              className="panel space-y-1.5 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                autoFocus
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Label — e.g. home city"
                className="placeholder:text-muted-foreground/60 w-full bg-transparent px-1 py-0.5 text-[12px] outline-none"
              />
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Fact — e.g. Oakland"
                className="placeholder:text-muted-foreground/60 w-full bg-transparent px-1 py-0.5 text-[12.5px] font-medium outline-none placeholder:font-normal"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="text-muted-foreground hover:text-foreground rounded-full px-2 py-0.5 text-[11.5px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !key.trim() || !value.trim()}
                  className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-[11.5px] font-medium disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1.5 py-1 text-[12px] transition-colors"
            >
              <Plus className="h-3 w-3" /> Add a fact
            </button>
          )}
        </div>
      )}

      {memory.sessions.length > 0 && (
        <div>
          <p className="type-micro text-muted-foreground/70 mb-1.5">Earlier conversations</p>
          <ol className="border-border-strong ml-[5px] space-y-2 border-l border-dashed pl-3">
            {memory.sessions.map((s) => (
              <li key={s.id} className="relative">
                <span className="border-background bg-muted-foreground/40 absolute -left-[16.5px] top-1.5 h-2 w-2 rounded-full border-2" />
                <span className="text-muted-foreground block text-[11px]">
                  {relativeTime(s.endedAt)} · {s.messageCount} messages
                </span>
                <span className="leading-snug">{s.summary}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {empty && (
        <p
          className={cn(
            'text-muted-foreground px-1.5 text-[12px] leading-relaxed',
            contactId && 'pt-1',
          )}
        >
          Once a conversation goes quiet, the AI writes a short summary of it here and picks up
          lasting details about the person.
        </p>
      )}
    </div>
  );
}
