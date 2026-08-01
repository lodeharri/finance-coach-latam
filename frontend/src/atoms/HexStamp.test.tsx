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

  it('is aria-hidden (decorative) by default', () => {
    const { container } = render(<HexStamp />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders at least 6 hex polygons (lattice pattern)', () => {
    const { container } = render(<HexStamp />);
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBeGreaterThanOrEqual(6);
  });

  it('defaults to the sm size (16 px)', () => {
    const { container } = render(<HexStamp />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
  });

  it('supports md (24 px) and lg (40 px) sizes for editorial layouts', () => {
    const { container: mid } = render(<HexStamp size="md" />);
    const { container: large } = render(<HexStamp size="lg" />);
    expect(mid.querySelector('svg')).toHaveAttribute('width', '24');
    expect(large.querySelector('svg')).toHaveAttribute('width', '40');
  });

  it('when given a title, exposes the title element for assistive tech', () => {
    const { container } = render(<HexStamp title="Litografía del Sur" />);
    const svg = container.querySelector('svg');
    const titleEl = svg?.querySelector('title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe('Litografía del Sur');
    expect(svg).toHaveAttribute('role', 'img');
  });
});
