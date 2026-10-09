import Link from 'next/link';
import { site } from '@/lib/site';
import { HeroStage } from '@/components/landing/hero-stage';
import { LiveDemo } from '@/components/landing/live-demo';
import { Bento } from '@/components/landing/bento';
import { DeployTabs } from '@/components/landing/deploy-tabs';
import { Arrow, Check, GitHubIcon } from '@/components/ui/icons';

const WORKS_WITH = [
  'iMessage via BlueBubbles',
  'Railway',
  'Cloudflare',
  'Docker',
  'Postgres',
  'Redis',
  'Cloudflare R2',
  'Amazon S3',
  'Anthropic',
  'Google sign-in',
  'GitHub sign-in',
  'SMTP',
];

const FACTS = [
  { value: '2', label: 'environment variables to deploy' },
  { value: '~10 min', label: 'from fork to first message' },
  { value: '0', label: 'seat limits on the free version' },
  { value: 'AGPLv3', label: 'every line readable and yours' },
];

const STEPS = [
  {
    n: '01',
    title: 'Connect your Mac',
    body: 'Run BlueBubbles on a Mac signed into iMessage. Paste its URL into Comms — webhooks register themselves and history backfills.',
  },
  {
    n: '02',
    title: 'Invite the team',
    body: 'Everyone gets the shared number in one inbox, with roles, assignment and live presence. Email, magic link, Google or GitHub sign-in.',
  },
  {
    n: '03',
    title: 'Answer together',
    body: 'Tickets, notes, macros and automations on top of plain iMessage. Your customers never install anything.',
  },
];

const FAQ = [
  {
    q: 'Do my customers need to install anything?',
    a: 'No. They text your number from Messages like they always have. Comms sits on your side of the conversation.',
  },
  {
    q: 'Why does it need a Mac?',
    a: 'Apple has no public iMessage API. BlueBubbles — open source — runs on a Mac signed into iMessage and bridges it to Comms. Any always-on Mac works, including a Mac mini in a closet.',
  },
  {
    q: 'Is the free version cut down?',
    a: 'No. The shared inbox, ticketing, macros, automations, AI features and the bridge are all AGPLv3 with no seat limit. Enterprise adds a team that sets it up for you, custom integrations, SSO and compliance tooling.',
  },
  {
    q: 'Where do my messages live?',
    a: 'In your Postgres, on infrastructure you own — even when we set it up for you. No third party sits in the message path, and AI features only run if you add a key.',
  },
  {
    q: 'Is it only for iMessage?',
    a: 'iMessage is the first channel. The architecture is channel-agnostic; WhatsApp and others are on the roadmap.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-24 pt-32 sm:pt-40">
        <Backdrop />
        <div className="container relative text-center">
          <p className="eyebrow animate-rise mx-auto">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-pulse-ring bg-success absolute inline-flex h-full w-full rounded-full" />
              <span className="bg-success relative inline-flex h-1.5 w-1.5 rounded-full" />
            </span>
            Open source · Now deploys to Cloudflare
            <Arrow className="h-3 w-3" />
          </p>

          <h1 className="mx-auto mt-7 max-w-[15ch] text-[44px] leading-[0.98] sm:text-7xl lg:text-[88px]">
            <span
              className="text-gradient animate-rise block"
              style={{ ['--delay' as string]: '80ms' }}
            >
              One iMessage number.
            </span>
            <span className="animate-rise block" style={{ ['--delay' as string]: '200ms' }}>
              <span className="text-gradient">Your </span>
              <span className="text-gradient-accent pr-2 font-serif font-normal italic tracking-[-0.02em]">
                whole team.
              </span>
            </span>
          </h1>

          <p
            className="animate-rise text-muted-foreground mx-auto mt-7 max-w-[54ch] text-[17px] leading-relaxed sm:text-lg"
            style={{ ['--delay' as string]: '320ms' }}
          >
            Comms turns a shared iMessage number into a help desk. Assign conversations as tickets,
            reply together without colliding, and keep every thread in a system you own.
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ ['--delay' as string]: '440ms' }}
          >
            <Link href={site.contact} className="btn-primary h-12 px-6">
              Get in touch <Arrow className="h-4 w-4" />
            </Link>
            <a href={site.github} target="_blank" rel="noreferrer" className="btn-ghost h-12 px-6">
              <GitHubIcon className="h-4 w-4" /> Self-host it
            </a>
          </div>
          <p
            className="animate-rise text-subtle mt-4 text-[13px]"
            style={{ ['--delay' as string]: '520ms' }}
          >
            No seat limit · No license key · The free version is the whole product
          </p>
        </div>

        <div
          id="product"
          className="animate-rise relative mt-16 scroll-mt-28 px-4 sm:mt-20"
          style={{ ['--delay' as string]: '600ms' }}
        >
          <HeroStage />
        </div>
      </section>

      {/* ── Works with ─────────────────────────────────────────────────── */}
      <section aria-label="Works with" className="border-line relative border-y py-7">
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="animate-marquee flex shrink-0 gap-3 pr-3 hover:[animation-play-state:paused]">
            {[...WORKS_WITH, ...WORKS_WITH].map((w, i) => (
              <span
                key={i}
                aria-hidden={i >= WORKS_WITH.length}
                className="border-line text-muted-foreground whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px]"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live demo ──────────────────────────────────────────────────── */}
      <section className="container relative py-28 sm:py-36">
        <SectionHead
          eyebrow="Try it"
          title={
            <>
              Your customers just text.
              <br />
              <span className="text-muted-foreground">Your team gets a help desk.</span>
            </>
          }
          body="Be the customer for a second. Send a text from the phone and follow it into the desk — tagged, assigned and answered."
        />
        <div data-reveal className="mt-16">
          <LiveDemo />
        </div>
      </section>

      {/* ── Facts ──────────────────────────────────────────────────────── */}
      <section className="container">
        <div className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-3xl border lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <div
              key={f.label}
              data-reveal
              style={{ ['--delay' as string]: `${i * 90}ms` }}
              className="bg-background p-6 sm:p-8"
            >
              <p className="text-gradient font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                {f.value}
              </p>
              <p className="text-muted-foreground mt-2 text-[13px]">{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="container scroll-mt-24 py-28 sm:py-36">
        <SectionHead
          eyebrow="Features"
          title={
            <>
              Everything a support team needs.
              <br />
              <span className="text-muted-foreground">Nothing it has to learn.</span>
            </>
          }
          body="Every card below is the real interaction, not a screenshot. Hover, click, toggle."
        />
        <div className="mt-16">
          <Bento />
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="container pb-28 sm:pb-36">
        <SectionHead eyebrow="How it works" title="Live in an afternoon." />
        <ol className="relative mt-14 grid gap-4 md:grid-cols-3">
          <div
            aria-hidden
            className="via-accent/50 absolute left-[16%] right-[16%] top-[30px] hidden h-px bg-gradient-to-r from-transparent to-transparent md:block"
          />
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              data-reveal
              style={{ ['--delay' as string]: `${i * 140}ms` }}
              className="relative text-center"
            >
              <span className="panel text-accent-soft relative mx-auto grid h-[60px] w-[60px] place-items-center rounded-2xl font-mono text-sm shadow-[0_0_30px_-6px_rgb(var(--accent)/0.6)]">
                {s.n}
              </span>
              <h3 className="mt-6 text-lg">{s.title}</h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-[34ch] text-[14px] leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Deploy ─────────────────────────────────────────────────────── */}
      <section
        id="deploy"
        className="border-line relative scroll-mt-24 border-y bg-[rgb(var(--surface-sunken))] py-28 sm:py-36"
      >
        <div
          aria-hidden
          className="dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)]"
        />
        <div className="container relative">
          <SectionHead
            eyebrow="Self-host"
            title={<>Run it where you already run things.</>}
            body="One repo, one Docker image. Comms generates its own secrets, derives its URL and migrates its own database."
          />
          <div data-reveal className="mt-14">
            <DeployTabs />
          </div>
        </div>
      </section>

      {/* ── Plans teaser ───────────────────────────────────────────────── */}
      <section className="container py-28 sm:py-36">
        <SectionHead
          eyebrow="Pricing"
          title="Free to own. Built around you if you need it."
          body="Run it yourself at no cost, or have us deploy it on your infrastructure and build the integrations your team needs."
        />
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2">
          <Plan
            name="Self-hosted"
            price="Free"
            cadence="forever"
            points={[
              'The entire product, AGPLv3',
              'Unlimited seats and history',
              'Your infrastructure, your data',
            ]}
            cta={{ label: 'Deploy it yourself', href: site.github, external: true }}
          />
          <Plan
            name="Enterprise"
            price="Custom"
            cadence="scoped to your team"
            points={[
              'We set it up on your infrastructure',
              'Custom integrations with your tools',
              'SSO, SCIM, audit export and an SLA',
            ]}
            cta={{ label: 'Contact us', href: site.contact }}
            featured
          />
        </div>
        <p data-reveal className="text-muted-foreground mt-6 text-center text-sm">
          Not sure which fits?{' '}
          <Link
            href="/pricing#enterprise"
            className="text-foreground underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
          >
            See what Enterprise includes
          </Link>
        </p>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="container pb-28 sm:pb-36">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <SectionHead eyebrow="FAQ" title="Questions, answered." align="left" />
          <div data-reveal className="border-line divide-y divide-white/[0.08] border-y">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-[15px] font-medium transition-colors hover:text-white">
                  {f.q}
                  <span className="faq-icon border-line text-muted-foreground ease-out-expo grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-transform duration-500">
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground max-w-[60ch] pb-5 text-[14px] leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="container pb-16">
        <div
          data-reveal
          className="panel relative overflow-hidden rounded-[32px] px-6 py-20 text-center sm:py-28"
        >
          <div
            aria-hidden
            className="animate-aurora bg-accent/25 pointer-events-none absolute -top-1/2 left-1/4 h-[140%] w-1/2 rounded-full blur-[120px]"
          />
          <div
            aria-hidden
            className="animate-aurora bg-violet/25 pointer-events-none absolute -bottom-1/2 right-1/4 h-[120%] w-1/3 rounded-full blur-[120px] [animation-delay:-9s]"
          />
          <div
            aria-hidden
            className="dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]"
          />
          <h2 className="relative mx-auto max-w-[18ch] text-4xl leading-[1.02] sm:text-6xl">
            <span className="text-gradient">Give your number </span>
            <span className="text-gradient-accent pr-1 font-serif font-normal italic">a team.</span>
          </h2>
          <p className="text-muted-foreground relative mx-auto mt-5 max-w-[46ch]">
            Fork the repo and own every line, or tell us what your team needs and we will build it
            out with you.
          </p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link href={site.contact} className="btn-primary h-12 px-6">
              Get in touch <Arrow className="h-4 w-4" />
            </Link>
            <a href={site.github} target="_blank" rel="noreferrer" className="btn-ghost h-12 px-6">
              <GitHubIcon className="h-4 w-4" /> Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_30%,transparent_100%)]" />
      <div className="animate-aurora bg-accent/20 absolute -top-40 left-[18%] h-[520px] w-[520px] rounded-full blur-[130px]" />
      <div className="animate-aurora bg-violet/20 absolute -top-24 right-[14%] h-[420px] w-[420px] rounded-full blur-[130px] [animation-delay:-7s]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  body,
  align = 'center',
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div data-reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-md'}>
      <p className="text-accent-soft text-[13px] font-medium">{eyebrow}</p>
      <h2 className="text-gradient mt-3 text-[34px] leading-[1.05] sm:text-5xl">{title}</h2>
      {body && <p className="text-muted-foreground mt-5 text-[16px] leading-relaxed">{body}</p>}
    </div>
  );
}

function Plan({
  name,
  price,
  cadence,
  points,
  cta,
  featured = false,
}: {
  name: string;
  price: string;
  cadence: string;
  points: string[];
  cta: { label: string; href: string; external?: boolean };
  featured?: boolean;
}) {
  const btn = featured ? 'btn-primary w-full' : 'btn-ghost w-full';
  return (
    <div
      data-reveal
      className={`panel relative overflow-hidden rounded-3xl p-7 ${featured ? 'shadow-[0_0_0_1px_rgb(var(--accent)/0.35),0_30px_80px_-30px_rgb(var(--accent)/0.5)]' : ''}`}
    >
      {featured && (
        <div
          aria-hidden
          className="bg-accent/25 pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        />
      )}
      <p className="relative text-[15px] font-medium">{name}</p>
      <p className="relative mt-4 flex items-baseline gap-2">
        <span className="font-display text-5xl font-semibold tracking-tight">{price}</span>
        <span className="text-muted-foreground text-sm">{cadence}</span>
      </p>
      <ul className="text-muted-foreground relative mt-6 space-y-2.5 text-[14px]">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <Check className="text-accent-soft mt-0.5 h-4 w-4 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
      <div className="relative mt-8">
        {cta.external ? (
          <a href={cta.href} target="_blank" rel="noreferrer" className={btn}>
            {cta.label}
          </a>
        ) : (
          <Link href={cta.href} className={btn}>
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
