'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Sparkles, FileText, Wand2, Copy } from 'lucide-react';
import { WorkingLabel } from '@/components/ai/ai-ui';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  improveDraftAction,
  summarizeConversationAction,
  suggestReplyAction,
} from '@/server/actions/ai';

export function AiAssist({
  conversationId,
  draft,
  onDraft,
}: {
  conversationId: string;
  /** What's currently in the composer. Decides whether AI writes or edits. */
  draft?: string;
  onDraft: (text: string) => void;
}) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  // Track which button fired so only that one shows a spinner.
  const [active, setActive] = useState<'suggest' | 'summarize' | null>(null);

  // Writing from scratch is only the right offer when there is nothing to work
  // from. Once you have typed something, a suggestion that replaces it is a
  // worse deal than one that sharpens it — you already know what you mean.
  const hasDraft = Boolean(draft?.trim());

  function suggest() {
    setActive('suggest');
    start(async () => {
      if (hasDraft) {
        const previous = draft ?? '';
        const res = await improveDraftAction({ conversationId, draft: previous });
        if (res.ok) {
          onDraft(res.text);
          // Their words were on screen a moment ago and are now gone. One
          // click has to be enough to get them back.
          toast.success('Draft rewritten — review before sending.', {
            action: { label: 'Undo', onClick: () => onDraft(previous) },
          });
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await suggestReplyAction(conversationId);
        if (res.ok) {
          onDraft(res.text);
          toast.success('Draft inserted — review before sending.');
        } else {
          toast.error(res.error);
        }
      }
      setActive(null);
    });
  }

  function summarize() {
    setActive('summarize');
    start(async () => {
      const res = await summarizeConversationAction(conversationId);
      if (res.ok) setSummary(res.text);
      else toast.error(res.error);
      setActive(null);
    });
  }

  // While the model works, the two buttons give way to one live label — the
  // verb, a pixel loader and the seconds elapsed — so a slow call reads as
  // progress rather than a stuck spinner.
  if (pending && active) {
    return (
      <span className="flex h-7 items-center px-2">
        <WorkingLabel
          label={
            active === 'summarize' ? 'Reading the thread' : hasDraft ? 'Rewriting' : 'Drafting'
          }
        />
      </span>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-brand hover:bg-brand-muted hover:text-brand gap-1.5"
        onClick={suggest}
        disabled={pending}
        title={
          hasDraft
            ? 'Rewrite what you have written — same meaning, better wording'
            : 'Draft a reply to the latest messages'
        }
      >
        {hasDraft ? <Wand2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        {hasDraft ? 'Improve' : 'Suggest reply'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="gap-1.5"
        onClick={summarize}
        disabled={pending}
      >
        <FileText className="h-3.5 w-3.5" />
        Summarize
      </Button>

      <Dialog open={summary !== null} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-[480px]">
          <DialogHeader className="border-border-strong space-y-0 border-b border-dashed px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <Sparkles className="text-brand h-4 w-4" />
              Conversation summary
            </DialogTitle>
            <DialogDescription className="sr-only">
              An AI summary of this conversation.
            </DialogDescription>
          </DialogHeader>
          <p className="animate-fade-in whitespace-pre-wrap px-5 py-4 text-[13.5px] leading-relaxed">
            {summary}
          </p>
          <div className="border-border-strong flex items-center justify-end gap-2 border-t border-dashed px-4 py-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (summary) void navigator.clipboard.writeText(summary);
                toast.success('Summary copied');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button size="sm" variant="brand" onClick={() => setSummary(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
