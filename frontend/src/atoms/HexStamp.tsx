/**
 * HexStamp atom — Litografía del Sur signature element.
 *
 * Hand-drawn hexagonal lattice in cobalt ink. Decorative; aria-hidden.
 * Anchors the cobalt masthead as the "system integrity" stamp (design §1.5).
 * Atoms have no state, no API.
 *
 * Three sizes are supported: sm (16px — sidebar/chrome), md (24px — masthead),
 * lg (40px — auth plate). The shape and lattice never change; the size scales
 * the viewBox-uniform polygons uniformly.
 */

/**
 * A hexagonal lattice of 7 hexes (center + 6 around) drawn in the cobalt ink.
 * Coordinates are hand-computed for a 16x16 viewBox at unit-hex radius = 3.
 */
export type HexStampSize = 'sm' | 'md' | 'lg';

export interface HexStampProps {
  size?: HexStampSize;
  /** Optional accessible label override; default aria-hidden. */
  title?: string;
}

const SIZE_PX: Record<HexStampSize, number> = {
  sm: 16,
  md: 24,
  lg: 40,
};

export function HexStamp({ size = 'sm', title }: HexStampProps) {
  const px = SIZE_PX[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 16 16"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
      data-testid="hex-stamp"
      style={{ color: 'var(--ink-cobalto)', display: 'inline-block' }}
    >
      {title ? <title>{title}</title> : null}
      {/* Center hex */}
      <polygon points="8,3 11.2,5 11.2,9 8,11 4.8,9 4.8,5" fill="currentColor" />
      {/* Top */}
      <polygon points="8,0.5 9.6,1.5 9.6,3.5 8,4.5 6.4,3.5 6.4,1.5" fill="currentColor" />
      {/* Top-right */}
      <polygon
        points="12.4,2.5 14,3.5 14,5.5 12.4,6.5 10.8,5.5 10.8,3.5"
        fill="currentColor"
      />
      {/* Bottom-right */}
      <polygon
        points="12.4,8.5 14,9.5 14,11.5 12.4,12.5 10.8,11.5 10.8,9.5"
        fill="currentColor"
      />
      {/* Bottom */}
      <polygon
        points="8,10.5 9.6,11.5 9.6,13.5 8,14.5 6.4,13.5 6.4,11.5"
        fill="currentColor"
      />
      {/* Bottom-left */}
      <polygon
        points="3.6,8.5 5.2,9.5 5.2,11.5 3.6,12.5 2,11.5 2,9.5"
        fill="currentColor"
      />
      {/* Top-left */}
      <polygon
        points="3.6,2.5 5.2,3.5 5.2,5.5 3.6,6.5 2,5.5 2,3.5"
        fill="currentColor"
      />
    </svg>
  );
}
