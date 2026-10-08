'use client';

import { useEffect, useRef, useState } from 'react';

/** True when the visitor asked the OS for less motion. Scripted demos pause. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Whether an element is on screen. Scripted demos only tick while visible, so a
 * page full of animated cards costs nothing for the ones you've scrolled past.
 */
export function useInView<T extends Element>(rootMargin = '0px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e?.isIntersecting ?? false), {
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, inView] as const;
}

/**
 * Runs `steps` in a loop, one every `ms`, while `active`. Returns the current
 * step index. The single clock behind every scripted card on the page.
 */
export function useLoop(steps: number, ms: number, active: boolean): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => window.clearInterval(id);
  }, [steps, ms, active]);
  return step;
}

/** Reveals text one character at a time; restarts whenever `text` changes. */
export function useTypewriter(text: string, active: boolean, cps = 38): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
  }, [text]);
  useEffect(() => {
    if (!active || n >= text.length) return;
    const id = window.setTimeout(() => setN((v) => v + 1), 1000 / cps);
    return () => window.clearTimeout(id);
  }, [active, n, text, cps]);
  return active ? text.slice(0, n) : text;
}
