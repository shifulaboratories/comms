import { cn } from '@/lib/utils';

/**
 * The Comms mark: a white speech bubble on a blue-to-violet tile — the same
 * mark the marketing site and link previews use, so the product and its
 * front door read as one brand.
 */
export function Logo({
  className,
  size = 'md',
  showWordmark = true,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}) {
  const mark = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-[0.95rem]' : 'text-[1.05rem]';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* The tile is a CSS gradient rather than an SVG <linearGradient>: the
          logo renders more than once (sidebar and the hidden mobile bar), and
          an SVG gradient referenced by id fails when its first copy is in a
          display:none subtree. */}
      <span
        className={cn('relative inline-block shrink-0 rounded-[28%]', mark)}
        style={{ background: 'linear-gradient(135deg, #64AAFF, #7C6CFF)' }}
        aria-hidden
      >
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full" fill="none">
          <path
            d="M9 11.5c0-1.9 1.6-3.5 3.5-3.5h7c1.9 0 3.5 1.6 3.5 3.5v4c0 1.9-1.6 3.5-3.5 3.5h-4.2L11.6 22v-3.2A3.5 3.5 0 0 1 9 15.5v-4Z"
            fill="#fff"
          />
          <circle cx="13" cy="13.6" r="1.1" fill="#3D6BFF" />
          <circle cx="16" cy="13.6" r="1.1" fill="#3D6BFF" />
          <circle cx="19" cy="13.6" r="1.1" fill="#3D6BFF" />
        </svg>
      </span>
      {showWordmark && <span className={cn('font-semibold tracking-[-0.02em]', text)}>Comms</span>}
    </div>
  );
}
