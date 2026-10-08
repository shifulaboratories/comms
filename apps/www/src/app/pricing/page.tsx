import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { SpotlightGroup } from '@/components/ui/spotlight';
import { Check } from '@/components/ui/icons';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Self-host Comms free forever under the AGPLv3, or let us run it. Enterprise adds SSO, audit retention and billing.',
};

/**
 * The tiers mirror the licensing structure exactly: everything in the "Free"
 * column is AGPLv3 in the repository, and every "Enterprise" line maps to a
 * feature key in packages/enterprise/src/features.ts. If the two ever disagree,
 * this page is the one that is wrong.
 */
const tiers = [
  {
    name: 'Self-hosted',
    price: 'Free',
    cadence: 'forever',
    summary: 'The whole product, on your own infrastructure. No seat limit and no license key.',
    cta: { label: 'Deploy it yourself', href: site.github, external: true },
    highlight: false,
    features: [
      'Unlimited seats, conversations and history',
      'Shared inbox, ticketing, macros, automations, SLA',
      'Internal notes, tags, folders, saved views',
      'Role-based access control',
      'Email + password, magic links, Google and GitHub sign-in',
      'Audit trail of sensitive actions',
      'AI summaries, suggested replies and triage (your API key)',
      'Community support on GitHub',
    ],
  },
  {
    name: 'Cloud',
    price: '$12',
    cadence: 'per user / month',
    summary: 'The same build, run by us. For teams who would rather not operate Postgres.',
    cta: { label: 'Start a trial', href: '/pricing#cloud', external: false },
    highlight: true,
    features: [
      'Everything in Self-hosted',
      'Managed Postgres, Redis and object storage',
      'Automatic updates, backups and monitoring',
      'Email delivery and AI features included — no keys to supply',
      'Email support, next business day',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'annual',
    summary: 'For teams with a procurement process. Available on Cloud or self-hosted.',
    cta: { label: 'Talk to us', href: '/pricing#enterprise', external: false },
    highlight: false,
    features: [
      'Everything in Cloud',
      'SAML 2.0 / OIDC against your identity provider',
      'SCIM provisioning and domain-verified auto-join',
      'Audit log retention windows and CSV / SIEM export',
      'Self-hosted license key — verified offline, no phone home',
      'Priority support and an SLA',
    ],
  },
] as const;

const faqs = [
  {
    q: 'Is the free version crippled?',
    a: 'No. The shared inbox, ticketing, macros, automations, AI features and the BlueBubbles bridge are all AGPLv3, with no seat limit and no key. What is paid for is billing, enterprise identity, and compliance tooling — the things a company with a procurement process needs and a self-hoster never touches.',
  },
  {
    q: 'What does AGPLv3 mean for me?',
    a: 'If you run Comms for your own team — even commercially, even at scale — it means nothing you need to act on. The obligation only bites if you modify Comms and offer the modified version to other people over a network: then you owe those users your changes. Running it unmodified, or keeping your changes to yourself internally, is fine.',
  },
  {
    q: 'Can I run Comms as a service for my own customers?',
    a: 'Yes. The AGPLv3 permits commercial hosting. You would need to publish your modifications to the users of that service, and you could not use anything under packages/enterprise/ without a subscription.',
  },
  {
    q: 'Is Cloud a different codebase?',
    a: 'No. Cloud is this repository with billing switched on. That is deliberate: a fork we maintain privately would drift, and the self-hosted build would quietly become the worse one.',
  },
  {
    q: 'What happens if my subscription lapses?',
    a: 'Enterprise features keep working for a 14-day grace period, then switch off. Nothing else changes — the inbox keeps serving messages, your data stays yours, and an expired key never takes the app down. Self-hosted installs verify the key offline, so an outage on our side cannot lock you out.',
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-14 pt-36 sm:pt-44">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-aurora bg-accent/20 absolute -top-40 left-1/3 h-[460px] w-[460px] rounded-full blur-[130px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_20%,transparent_100%)]" />
        </div>
        <div className="container relative text-center">
          <p className="animate-rise text-accent-soft text-[13px] font-medium">Pricing</p>
          <h1
            className="text-gradient animate-rise mx-auto mt-3 max-w-[16ch] text-5xl leading-[1.02] sm:text-7xl"
            style={{ ['--delay' as string]: '80ms' }}
          >
            Own it free. Or let us run it.
          </h1>
          <p
            className="animate-rise text-muted-foreground mx-auto mt-6 max-w-[56ch] text-lg leading-relaxed"
            style={{ ['--delay' as string]: '180ms' }}
          >
            Self-host the whole product free, forever. Pay us only if you would rather not run it
            yourself, or if you need the enterprise identity and compliance pieces.
          </p>
        </div>
      </section>

      <section className="container pb-6">
        <SpotlightGroup className="grid gap-4 lg:grid-cols-3">
          {tiers.map((tier, i) => (
            <div
              key={tier.name}
              id={tier.name.toLowerCase()}
              data-reveal
              style={{ ['--delay' as string]: `${i * 100}ms` }}
              className={`spotlight panel relative flex scroll-mt-28 flex-col overflow-hidden rounded-3xl p-7 ${
                tier.highlight
                  ? 'shadow-[0_0_0_1px_rgb(var(--accent)/0.35),0_40px_90px_-30px_rgb(var(--accent)/0.45)]'
                  : ''
              }`}
            >
              {tier.highlight && (
                <div
                  aria-hidden
                  className="bg-accent/25 pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl"
                />
              )}
              <div className="relative flex items-center justify-between">
                <h2 className="text-lg">{tier.name}</h2>
                {tier.highlight && (
                  <span className="bg-accent/15 text-accent-soft ring-accent/30 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset">
                    Most popular
                  </span>
                )}
              </div>

              <div className="relative mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold tracking-tight">
                  {tier.price}
                </span>
                <span className="text-muted-foreground text-sm">{tier.cadence}</span>
              </div>

              <p className="text-muted-foreground relative mt-4 min-h-[3.5rem] text-sm leading-relaxed">
                {tier.summary}
              </p>

              <a
                href={tier.cta.href}
                {...(tier.cta.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className={`relative mt-6 w-full ${tier.highlight ? 'btn-primary' : 'btn-ghost'}`}
              >
                {tier.cta.label}
              </a>

              <ul className="border-line relative mt-8 space-y-3 border-t pt-6 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2.5 leading-relaxed">
                    <Check
                      className={`mt-[3px] h-4 w-4 shrink-0 ${tier.highlight ? 'text-accent-soft' : 'text-foreground/70'}`}
                    />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </SpotlightGroup>
      </section>

      <section className="container py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <div data-reveal className="max-w-md">
            <p className="text-accent-soft text-[13px] font-medium">FAQ</p>
            <h2 className="text-gradient mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Questions people actually ask.
            </h2>
            <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
              The exact terms are in the repository, not in a sales deck: the{' '}
              <a
                href={site.license}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
              >
                AGPLv3 and its exceptions
              </a>{' '}
              at the root, and the{' '}
              <a
                href={`${site.github}/blob/main/packages/enterprise/LICENSE`}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
              >
                Enterprise Edition license
              </a>{' '}
              alongside the code it covers.
            </p>
          </div>
          <div data-reveal className="border-line divide-y divide-white/[0.08] border-y">
            {faqs.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-[15px] font-medium">
                  {f.q}
                  <span className="faq-icon border-line text-muted-foreground ease-out-expo grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-transform duration-500">
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground max-w-[62ch] pb-5 text-[14px] leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
