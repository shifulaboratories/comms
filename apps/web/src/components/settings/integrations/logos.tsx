/**
 * Small marks for the integration tiles. Simplified, single-colour shapes in
 * each product's colour — enough to recognise at 40px, not reproductions.
 */
export function ClaudeMark({ className }: { className?: string }) {
  // Twelve tapered rays around a centre, Claude's sunburst.
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#D97757" />
      <g transform="translate(24 24)" fill="#fff">
        {rays.map((deg, i) => (
          <path
            key={deg}
            transform={`rotate(${deg})`}
            d={i % 2 ? 'M-1.4 -3 L0 -13 L1.4 -3 Z' : 'M-1.7 -3 L0 -15.5 L1.7 -3 Z'}
          />
        ))}
        <circle r="3.6" />
      </g>
    </svg>
  );
}

export function OpenAIMark({ className }: { className?: string }) {
  // Six interlocking rounded links, after OpenAI's blossom.
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" className="fill-zinc-900 dark:fill-white" />
      <g
        transform="translate(24 24)"
        fill="none"
        strokeWidth="2.4"
        strokeLinejoin="round"
        className="stroke-white dark:stroke-zinc-900"
      >
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect
            key={deg}
            x="-3.6"
            y="-12.5"
            width="7.2"
            height="14"
            rx="3.6"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
    </svg>
  );
}

export function McpMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" className="fill-muted" />
      <g fill="none" strokeWidth="2.6" strokeLinecap="round" className="stroke-foreground">
        <path d="M13 25 L23 15 a4.5 4.5 0 0 1 6.4 6.4 L21 29.8" />
        <path d="M19 31 L28.5 21.5 a4.5 4.5 0 0 1 6.4 6.4 L27 35.8 a2 2 0 0 0 0 2.8 L29 40.5" />
        <path d="M24.5 18.5 L16 27 a4.5 4.5 0 0 0 6.4 6.4" opacity="0.55" />
      </g>
    </svg>
  );
}

export function TwentyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" className="fill-zinc-900 dark:fill-white" />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="20"
        fontWeight="800"
        className="fill-white dark:fill-zinc-900"
      >
        20
      </text>
    </svg>
  );
}
