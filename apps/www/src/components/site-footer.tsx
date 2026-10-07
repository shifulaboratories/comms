import Link from 'next/link';
import { site } from '@/lib/site';
import { Logo } from '@/components/ui/icons';

export function SiteFooter() {
  return (
    <footer className="border-line relative mt-10 border-t">
      <div className="container grid gap-10 py-14 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold">
            <Logo className="h-6 w-6" />
            {site.name}
          </Link>
          <p className="text-muted-foreground mt-3 max-w-xs">{site.tagline}</p>
        </div>
        <div className="space-y-2.5">
          <p className="text-subtle text-xs font-medium uppercase tracking-wider">Product</p>
          <Link href="/#features" className="text-muted-foreground hover:text-foreground block">
            Features
          </Link>
          <Link href="/#deploy" className="text-muted-foreground hover:text-foreground block">
            Self-hosting
          </Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground block">
            Pricing
          </Link>
        </div>
        <div className="space-y-2.5">
          <p className="text-subtle text-xs font-medium uppercase tracking-wider">Open source</p>
          <a
            href={site.github}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground block"
          >
            GitHub
          </a>
          <a
            href={site.docs}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground block"
          >
            Docs
          </a>
          <a
            href={site.license}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground block"
          >
            AGPLv3 license
          </a>
        </div>
      </div>
      <div className="border-line text-subtle container flex flex-col justify-between gap-2 border-t py-6 text-xs sm:flex-row">
        <p>
          © {new Date().getFullYear()} {site.name}. Open source under AGPLv3.
        </p>
        <p>iMessage is a trademark of Apple Inc. Comms is not affiliated with Apple.</p>
      </div>
    </footer>
  );
}
