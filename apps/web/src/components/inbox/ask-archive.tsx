'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowUp, MessageSquareText, ArrowUpRight } from 'lucide-react';
import { ThinkingTrace, useSteppedTrace } from '@/components/ai/ai-ui';
import { askArchiveAction, type ArchiveSource } from '@/server/actions/ai';

const EXAMPLES = [
  'what did we agree on about the deposit?',
  'who asked about availability this month?',
  'what address did they send me?',
];

/**
 * Ask a question of the whole message archive.
 *
 * The answer always ships with the conversations it came from. An AI answer
 * about your own history that you cannot check is worse than no answer — this
 * is the one place where being able to verify matters more than being fast.
 */
export function AskArchive() {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<ArchiveSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // One server call, but three real steps — show them, so a ten-second
  // answer reads as reading rather than hanging.
  const steps = useSteppedTrace(
    ['Searching your messages', 'Reading the matching conversations', 'Writing an answer'],
    pending,
  );

  function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || pending) return;
    setAsked(trimmed);
    setAnswer(null);
    setSources([]);
    setError(null);
    start(async () => {
      const res = await askArchiveAction(trimmed);
      if (res.ok) {
        setAnswer(res.answer);
        setSources(res.sources);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface focus-within:border-brand/50 focus-within:ring-brand/12 dark:bg-secondary relative rounded-2xl border shadow-sm transition-all duration-200 focus-within:ring-[3px]">
        <Sparkles className="text-muted-foreground/70 pointer-events-none absolute left-3.5 top-3.5 h-4 w-4" />
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          rows={2}
          placeholder="Ask anything about your messages…"
          className="type-body placeholder:text-muted-foreground/60 w-full resize-none bg-transparent py-3 pl-10 pr-14 outline-none"
        />
        <button
          type="button"
          onClick={() => ask(question)}
          disabled={!question.trim() || pending}
          aria-label="Ask"
          className="bg-primary text-primary-foreground shadow-brand disabled:bg-muted-foreground/25 absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full transition-all duration-200 disabled:shadow-none"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>

      {!asked && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setQuestion(e);
                ask(e);
              }}
              className="type-caption text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border px-2.5 py-1 transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {(pending || answer) && <ThinkingTrace steps={steps} done={!pending} />}

      {error && (
        <p className="type-body border-destructive/40 bg-destructive-muted text-destructive rounded-xl border px-3 py-2">
          {error}
        </p>
      )}

      {answer && (
        <div className="space-y-3">
          <p className="animate-fade-in whitespace-pre-wrap text-[14px] leading-relaxed">
            {answer}
          </p>

          {sources.length > 0 && (
            <div className="pt-2">
              <p className="flex items-center gap-2 pb-2 text-[13px] font-medium">
                Sources
                <span className="tabular text-muted-foreground rounded-md border px-1.5 font-mono text-[11px]">
                  {sources.length}
                </span>
              </p>
              <div className="space-y-2">
                {sources.map((s) => (
                  <Link
                    key={s.index}
                    href={`/inbox/${s.conversationId}`}
                    className="panel hover:border-border-strong group block overflow-hidden transition-all duration-200 hover:shadow-md"
                  >
                    <span className="flex items-center gap-2 border-b px-3.5 py-2.5">
                      <MessageSquareText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-[13px] font-medium">{s.conversationName}</span>
                      <span className="tabular text-muted-foreground ml-auto shrink-0 text-[11.5px]">
                        {s.at}
                      </span>
                    </span>
                    <span className="flex items-start gap-3 px-3.5 py-2.5">
                      <span className="text-muted-foreground line-clamp-2 flex-1 text-[13px] leading-relaxed">
                        {s.snippet}
                      </span>
                      <span className="text-muted-foreground group-hover:text-foreground mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10.5px] transition-colors">
                        [{s.index}]
                        <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
