'use client';

import { useState } from 'react';
import { Arrow, Check } from '@/components/ui/icons';

const SIZES = ['1–10', '11–50', '51–200', '200+'] as const;
const NEEDS = [
  'Set it up for us',
  'Custom integrations',
  'SSO / SCIM',
  'Ongoing support',
  'Something else',
] as const;

const field =
  'border-line focus:border-accent/60 focus:ring-accent/25 w-full rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-[14px] outline-none transition placeholder:text-subtle focus:ring-4';

/**
 * No backend: the form composes an email in the visitor's own mail client, so
 * an enquiry can never be lost to a broken endpoint and the reply thread
 * starts in a real inbox.
 */
export function ContactForm({ email }: { email: string }) {
  const [needs, setNeeds] = useState<string[]>(['Set it up for us']);
  const [size, setSize] = useState<string>('11–50');
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') ?? '').trim();
    const company = String(f.get('company') ?? '').trim();
    const subject = `Comms Enterprise — ${company || name || 'enquiry'}`;
    const body = [
      `Name: ${name}`,
      `Work email: ${String(f.get('email') ?? '').trim()}`,
      `Company: ${company}`,
      `Team size: ${size}`,
      `Interested in: ${needs.join(', ') || '—'}`,
      '',
      String(f.get('details') ?? '').trim(),
    ].join('\n');
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="panel relative space-y-5 rounded-3xl p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">Name</span>
          <input
            name="name"
            required
            autoComplete="name"
            className={field}
            placeholder="Riley Morgan"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">Work email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={field}
            placeholder="riley@company.com"
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium">Company</span>
        <input
          name="company"
          autoComplete="organization"
          className={field}
          placeholder="Acme Inc."
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium">Team size</legend>
        <div className="flex flex-wrap gap-2 pt-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() => setSize(s)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] ring-1 ring-inset transition ${
                size === s
                  ? 'bg-white text-black ring-white'
                  : 'text-muted-foreground ring-white/15 hover:bg-white/5 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium">What are you looking for?</legend>
        <div className="flex flex-wrap gap-2 pt-1.5">
          {NEEDS.map((n) => {
            const on = needs.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() => setNeeds((cur) => (on ? cur.filter((x) => x !== n) : [...cur, n]))}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] ring-1 ring-inset transition ${
                  on
                    ? 'bg-accent/15 text-accent-soft ring-accent/40'
                    : 'text-muted-foreground ring-white/15 hover:bg-white/5 hover:text-white'
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {n}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium">Tell us about your setup</span>
        <textarea
          name="details"
          rows={5}
          className={`${field} resize-y`}
          placeholder="Who answers your texts today, what tools they use, and what you'd want Comms to connect to."
        />
      </label>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" className="btn-primary h-12 shrink-0 whitespace-nowrap px-6">
          Send to our team <Arrow className="h-4 w-4" />
        </button>
        <p className="text-subtle text-[12.5px]" aria-live="polite">
          {sent ? (
            <>
              Your email app should have opened. If not, write to{' '}
              <a href={`mailto:${email}`} className="text-foreground underline underline-offset-4">
                {email}
              </a>
              .
            </>
          ) : (
            'Opens in your email app. We reply within one business day.'
          )}
        </p>
      </div>
    </form>
  );
}
