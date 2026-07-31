/**
 * HexStamp atom — Litografía del Sur signature element.
 *
 * 16x16 inline SVG hexagonal lattice in cobalt. Decorative; aria-hidden.
 * Anchors the cobalt masthead as the "system integrity" stamp (design §1.5).
 * Atoms have no state, no API.
 */

/**
 * A hexagonal lattice of 7 hexes (center + 6 around) drawn in the cobalt ink.
 * Coordinates are hand-computed for a 16x16 viewBox at unit-hex radius = 3.
 */
export function HexStamp() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ color: 'var(--ink-cobalto)', display: 'inline-block' }}
    >
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
