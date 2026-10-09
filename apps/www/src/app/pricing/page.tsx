import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { SpotlightGroup } from '@/components/ui/spotlight';
import { Arrow, Check } from '@/components/ui/icons';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Self-host Comms free forever under the AGPLv3, or have us set it up on your infrastructure and build the integrations your organization needs.',
};

/**
 * Two ways to run Comms. Everything in "Self-hosted" is AGPLv3 in the
 * repository. "Enterprise" is a service engagement on top: we deploy it on
 * infrastructure the customer owns, build what they need, and license the
 * features in packages/enterprise/src/features.ts. There is no hosted plan —
 * the data always lives with the customer.
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
      'AI summaries, suggested replies, triage and memory (your API key)',
      'Community support on GitHub',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'scoped to your organization',
    summary:
      'We set Comms up for you, on infrastructure you own, and build it out around how your team actually works.',
    cta: { label: 'Contact us', href: site.contact, external: false },
    highlight: true,
    features: [
      'Everything in Self-hosted',
      'Deployed and configured by us — your cloud account, your servers, your data',
      'Custom integrations: CRM, help desk, internal tools, webhooks and new channels',
      'Mac and BlueBubbles bridge setup, with monitoring',
      'SAML 2.0 / OIDC, SCIM provisioning and domain-verified auto-join',
      'Audit log retention and CSV / SIEM export',
      'Updates, backups and maintenance handled for you',
      'Onboarding for your team, priority support and an SLA',
    ],
  },
] as const;

const steps = [
  {
    n: '01',
    title: 'A call about your workflow',
    body: 'Who answers, what they answer with, and which systems the answers live in. We leave with a written scope and a fixed quote.',
  },
  {
    n: '02',
    title: 'We build and deploy it',
    body: 'Comms goes up on infrastructure you own, connected to your number, your sign-in and the tools you already use — plus anything custom you need.',
  },
  {
    n: '03',
    title: 'We keep it running',
    body: 'Updates, backups and the iMessage bridge are watched for you. New integrations and changes as your team grows.',
  },
] as const;

const builds = [
  {
    title: 'CRM sync',
    body: 'Contacts, deals and conversation history flow both ways with Salesforce, HubSpot or your own database.',
  },
  {
    title: 'Help desk handoff',
    body: 'Escalate a thread into Zendesk, Linear or Jira and keep the ticket and the texts linked.',
  },
  {
    title: 'Internal tools',
    body: 'Look up orders, bookings or accounts from inside a conversation, and act on them without switching tabs.',
  },
  {
    title: 'Automations',
    body: 'Routing, auto-replies and follow-ups tied to your business rules, not generic templates.',
  },
  { title: 'New channels', body: 'SMS, WhatsApp or email alongside iMessage, in the same inbox.' },
  {
    title: 'AI tuned to you',
    body: 'Replies in your voice, grounded in your docs and policies, running on the model and provider you choose.',
  },
] as const;

const faqs = [
  {
    q: 'Is the free version crippled?',
    a: 'No. The shared inbox, ticketing, macros, automations, AI features and the BlueBubbles bridge are all AGPLv3, with no seat limit and no key. Enterprise is for organizations that want it set up, extended and looked after for them.',
  },
  {
    q: 'Do you host it for us?',
    a: 'No — and that is on purpose. Comms runs on infrastructure you own: your cloud account, your servers, or a provider you pick. We do the setup and the upkeep there, so your messages never sit on our systems and you are never locked in.',
  },
  {
    q: 'What does a custom integration look like?',
    a: 'Anything with an API. Common ones are CRM sync, escalating threads into a help desk, looking up customer records inside a conversation, and adding channels like SMS or WhatsApp. We scope each one with you before building it.',
  },
  {
    q: 'What does AGPLv3 mean for me?',
    a: 'If you run Comms for your own team — even commercially, even at scale — it means nothing you need to act on. The obligation only bites if you modify Comms and offer the modified version to other people over a network: then you owe those users your changes. Running it unmodified, or keeping your changes to yourself internally, is fine.',
  },
  {
    q: 'Who owns the custom work?',
    a: 'You do. Integrations we build for you are delivered into your repository and run on your infrastructure. If you stop working with us, everything keeps running.',
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
            Own it free. Or have us build it for you.
          </h1>
          <p
            className="animate-rise text-muted-foreground mx-auto mt-6 max-w-[56ch] text-lg leading-relaxed"
            style={{ ['--delay' as string]: '180ms' }}
          >
            Self-host the whole product free, forever. Or work with us: we set it up on your
            infrastructure, connect it to your tools and build whatever your team needs on top.
          </p>
        </div>
      </section>

      <section className="container pb-6">
        <SpotlightGroup className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
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
                    Done for you
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

      <section className="container pt-28">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-accent-soft text-[13px] font-medium">How Enterprise works</p>
          <h2 className="text-gradient mt-3 text-4xl leading-[1.05] sm:text-5xl">
            From first call to running in your stack.
          </h2>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.n}
              data-reveal
              style={{ ['--delay' as string]: `${i * 100}ms` }}
              className="panel rounded-3xl p-7"
            >
              <p className="text-accent-soft font-mono text-[12px]">{step.n}</p>
              <h3 className="mt-4 text-lg">{step.title}</h3>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container pt-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <div data-reveal className="max-w-md">
            <p className="text-accent-soft text-[13px] font-medium">What we build</p>
            <h2 className="text-gradient mt-3 text-4xl leading-[1.05] sm:text-5xl">
              Comms, wired into everything else.
            </h2>
            <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
              A few of the integrations teams ask for. If it has an API, we can connect it.
            </p>
            <a href={site.contact} className="btn-primary mt-8 h-11 px-5">
              Tell us what you need <Arrow className="h-4 w-4" />
            </a>
          </div>
          <SpotlightGroup className="grid gap-3 sm:grid-cols-2">
            {builds.map((b, i) => (
              <div
                key={b.title}
                data-reveal
                style={{ ['--delay' as string]: `${i * 60}ms` }}
                className="spotlight panel rounded-2xl p-5"
              >
                <h3 className="text-[15px] font-medium">{b.title}</h3>
                <p className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed">{b.body}</p>
              </div>
            ))}
          </SpotlightGroup>
        </div>
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
