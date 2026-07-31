/**
 * CategoryPill molecule — TDD test suite (RED phase).
 *
 * Slug + name + hex color, inline swatch. No API calls.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/test-utils';
import { CategoryPill } from './CategoryPill';

describe('CategoryPill', () => {
  it('renders the category name', () => {
    render(<CategoryPill slug="groceries" name="Groceries" color="#1F3FB8" />);
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('renders an inline color swatch with the given hex', () => {
    const { container } = render(
      <CategoryPill slug="groceries" name="Groceries" color="#1F3FB8" />,
    );
    const swatch = container.querySelector('span > span') as HTMLElement | null;
    expect(swatch).not.toBeNull();
    // jsdom normalizes inline hex to rgb() — accept either form.
    const styleAttr = swatch!.getAttribute('style') ?? '';
    expect(styleAttr.toLowerCase()).toMatch(/rgb\(31,?\s*63,?\s*184\)|#1f3fb8/);
  });

  it('exposes the slug to assistive tech via title', () => {
    render(<CategoryPill slug="groceries" name="Groceries" color="#1F3FB8" />);
    const pill = screen.getByText('Groceries').parentElement as HTMLElement;
    expect(pill).toHaveAttribute('title', 'groceries');
  });
});
