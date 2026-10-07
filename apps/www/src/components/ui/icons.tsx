import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

/** Two overlapping speech bubbles — a shared conversation. */
export function Logo(props: P) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <defs>
        <linearGradient id="logo-a" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#64AAFF" />
          <stop offset="1" stopColor="#7C6CFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-a)" />
      <path
        d="M9 11.5c0-1.9 1.6-3.5 3.5-3.5h7c1.9 0 3.5 1.6 3.5 3.5v4c0 1.9-1.6 3.5-3.5 3.5h-4.2L11.6 22v-3.2A3.5 3.5 0 0 1 9 15.5v-4Z"
        fill="#fff"
      />
      <circle cx="13" cy="13.6" r="1.1" fill="#3D6BFF" />
      <circle cx="16" cy="13.6" r="1.1" fill="#3D6BFF" />
      <circle cx="19" cy="13.6" r="1.1" fill="#3D6BFF" />
    </svg>
  );
}

export function GitHubIcon(props: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.27 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function Check(props: P) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

export function Arrow(props: P) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function Sparkle(props: P) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8l5.1-1.4L8 1.5Z" />
    </svg>
  );
}

export function Plus(props: P) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function Send(props: P) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 2.5a.75.75 0 0 1 .53.22l4 4a.75.75 0 1 1-1.06 1.06L8.75 5.06v7.69a.75.75 0 0 1-1.5 0V5.06L4.53 7.78a.75.75 0 0 1-1.06-1.06l4-4A.75.75 0 0 1 8 2.5Z" />
    </svg>
  );
}

export function Clock(props: P) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2 1.4" />
    </svg>
  );
}

export function Bolt(props: P) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M9.2 1.5 3 9h4.3l-.5 5.5L13 7H8.7l.5-5.5Z" />
    </svg>
  );
}

export function Lock(props: P) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      {...props}
    >
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.6" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}

export function Moon(props: P) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6Z" />
    </svg>
  );
}

export function Terminal(props: P) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m3.5 5 3 3-3 3M8.5 11.5h4" />
    </svg>
  );
}
