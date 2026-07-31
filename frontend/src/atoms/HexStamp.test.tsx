/**
 * HexStamp atom — TDD test suite (RED phase).
 *
 * 16x16 inline SVG hexagonal lattice, cobalt fill. aria-hidden (decorative).
 * "System integrity" stamp that anchors the cobalt masthead (signature element).
 * Atoms have no state, no API.
 */
import { describe, expect, it } from 'vitest';
import { render } from '../test/test-utils';
import { HexStamp } from './HexStamp';

describe('HexStamp', () => {
  it('renders an SVG with viewBox 0 0 16 16', () => {
    const { container } = render(<HexStamp />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
  });

  it('uses --ink-cobalto as the fill color', () => {
    const { container } = render(<HexStamp />);
    const svg = container.querySelector('svg');
    const styleAttr = svg?.getAttribute('style') ?? '';
    expect(styleAttr).toMatch(/var\(--ink-cobalto\)|#1f3fb8/i);
  });

  it('is aria-hidden (decorative)', () => {
    const { container } = render(<HexStamp />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders at least 6 hex polygons (lattice pattern)', () => {
    const { container } = render(<HexStamp />);
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThanOrEqual(6);
  });
});
