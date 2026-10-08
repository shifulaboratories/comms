'use client';

import { useEffect } from 'react';

/**
 * One IntersectionObserver for every `[data-reveal]` element on the page,
 * instead of a client component per element. Server-rendered sections stay
 * server components and opt in with an attribute.
 */
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const scan = () =>
      document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => io.observe(el));
    scan();
    // Client-side navigation swaps the page without remounting the layout.
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
