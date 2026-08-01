/**
 * Spinner atom — Litografía del Sur.
 *
 * Inline SVG spinner. Uses --ink-cobalto (the single brand color). Reduced motion
 * is respected via Tailwind's motion-reduce:animate-none utility on the SVG.
 * Atoms have no state, no API.
 */
export interface SpinnerProps {
  /** Accessible label for screen readers; required because the spinner is decorative. */
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_PX: Record<NonNullable<SpinnerProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function Spinner({ 'aria-label': ariaLabel, size = 'md' }: SpinnerProps) {
  const px = SIZE_PX[size];
  return (
    <span
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
      style={{ width: px, height: px, display: 'inline-block' }}
    >
      <svg
        aria-hidden="true"
        width={px}
        height={px}
        viewBox="0 0 24 24"
        className="animate-spin motion-reduce:animate-none"
        style={{ color: 'var(--ink-cobalto)' }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
