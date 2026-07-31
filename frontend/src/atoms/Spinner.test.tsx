/**
 * Spinner atom — TDD test suite (RED phase).
 *
 * Exposes aria-busy. Reduced-motion respected (no animation).
 * Atoms have no state, no API.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders an element with aria-busy=true', () => {
    render(<Spinner aria-label="Loading" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('uses the provided aria-label', () => {
    render(<Spinner aria-label="Loading transactions" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading transactions');
  });

  it('renders an inline SVG (no external image dependencies)', () => {
    render(<Spinner aria-label="Loading" />);
    const status = screen.getByRole('status');
    expect(status.querySelector('svg')).not.toBeNull();
  });

  it('marks the SVG aria-hidden so screen readers ignore the visual spinner', () => {
    render(<Spinner aria-label="Loading" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies animate-spin and motion-reduce override on the inner SVG', () => {
    // jsdom does not match prefers-reduced-motion by default; verify both classes
    // are present so the motion-reduce media query can take effect in real browsers.
    render(<Spinner aria-label="Loading" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.className.baseVal).toMatch(/animate-spin/);
    expect(svg!.className.baseVal).toMatch(/motion-reduce:animate-none/);
  });
});
