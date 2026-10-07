'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { nav, site } from '@/lib/site';
import { Logo, GitHubIcon } from '@/components/ui/icons';

/**
 * Floating pill nav. Transparent over the hero, then condenses into a glass
 * capsule once you scroll — one passive listener, one boolean of state.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:pt-4">
      <div
        className={`ease-out-expo pointer-events-auto flex h-14 w-full max-w-[1120px] items-center justify-between rounded-full pl-4 pr-2 transition-all duration-500 ${
          scrolled
            ? 'glass max-w-[880px] shadow-[0_10px_40px_-12px_rgb(0_0_0/0.8)]'
            : 'border border-transparent'
        }`}
      >
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Logo className="h-6 w-6" />
          {site.name}
        </Link>

        <nav className="hidden items-center md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground rounded-full px-3.5 py-2 text-[13px] transition-colors hover:bg-white/5"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <a
            href={site.github}
            target="_blank"
            rel="noreferrer"
            aria-label="Comms on GitHub"
            className="text-muted-foreground hover:text-foreground grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/5"
          >
            <GitHubIcon className="h-[18px] w-[18px]" />
          </a>
          <Link href={site.trial} className="btn-primary h-10 px-4 text-[13px]">
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}
