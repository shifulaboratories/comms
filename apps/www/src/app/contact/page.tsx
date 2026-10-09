import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { ContactForm } from '@/components/contact-form';
import { Check } from '@/components/ui/icons';

export const metadata: Metadata = {
  title: 'Get in touch',
  description:
    'Talk to us about setting up Comms for your organization: deployment on your infrastructure, custom integrations, SSO and ongoing support.',
};

const POINTS = [
  'A call about how your team texts today, then a written scope and a fixed quote',
  'Deployed on infrastructure you own — your messages never touch our systems',
  'Integrations with your CRM, help desk and internal tools',
  'Ongoing updates, monitoring and support, if you want it',
];

export default function ContactPage() {
  return (
    <section className="relative overflow-hidden pb-24 pt-36 sm:pt-44">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-aurora bg-accent/20 absolute -top-40 left-1/4 h-[460px] w-[460px] rounded-full blur-[130px]" />
        <div className="animate-aurora bg-violet/15 absolute -top-24 right-[12%] h-[380px] w-[380px] rounded-full blur-[130px] [animation-delay:-7s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_20%,transparent_100%)]" />
      </div>
      <div className="container relative grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <p className="animate-rise text-accent-soft text-[13px] font-medium">Enterprise</p>
          <h1
            className="text-gradient animate-rise mt-3 max-w-[14ch] text-5xl leading-[1.02] sm:text-6xl"
            style={{ ['--delay' as string]: '80ms' }}
          >
            Let&rsquo;s build it around your team.
          </h1>
          <p
            className="animate-rise text-muted-foreground mt-6 max-w-[46ch] text-lg leading-relaxed"
            style={{ ['--delay' as string]: '180ms' }}
          >
            Tell us how your organization handles texts today. We&rsquo;ll set Comms up on your
            infrastructure and connect it to the tools you already use.
          </p>
          <ul
            className="animate-rise mt-9 space-y-3.5 text-[15px]"
            style={{ ['--delay' as string]: '260ms' }}
          >
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 leading-relaxed">
                <Check className="text-accent-soft mt-[4px] h-4 w-4 shrink-0" />
                <span className="text-muted-foreground">{p}</span>
              </li>
            ))}
          </ul>
          <p
            className="animate-rise text-subtle mt-10 text-sm"
            style={{ ['--delay' as string]: '340ms' }}
          >
            Prefer email?{' '}
            <a
              href={`mailto:${site.email}`}
              className="text-foreground underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
            >
              {site.email}
            </a>
            <br />
            Want to run it yourself?{' '}
            <a
              href={site.github}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
            >
              Self-host from GitHub
            </a>
          </p>
        </div>
        <div className="animate-rise" style={{ ['--delay' as string]: '220ms' }}>
          <ContactForm email={site.email} />
        </div>
      </div>
    </section>
  );
}
