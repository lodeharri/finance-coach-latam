/**
 * Pagination molecule — TDD test suite (RED phase).
 *
 * Renders prev/next/first/last + numbered page tokens, with ellipses between
 * distant groups. Pure presentational — no fetching, no state.
 *
 * Molecules have no API calls.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../test/test-utils';
import { Pagination, buildPageTokens } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages is 0', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the first and prev buttons disabled on page 1', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />);
    const first = screen.getByTestId('pagination-first') as HTMLButtonElement;
    const prev = screen.getByTestId('pagination-prev') as HTMLButtonElement;
    expect(first).toBeDisabled();
    expect(prev).toBeDisabled();
  });

  it('renders the next and last buttons disabled on the last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={() => {}} />);
    const next = screen.getByTestId('pagination-next') as HTMLButtonElement;
    const last = screen.getByTestId('pagination-last') as HTMLButtonElement;
    expect(next).toBeDisabled();
    expect(last).toBeDisabled();
  });

  it('renders next and prev enabled in the middle of the range', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />);
    const next = screen.getByTestId('pagination-next') as HTMLButtonElement;
    const prev = screen.getByTestId('pagination-prev') as HTMLButtonElement;
    expect(next).not.toBeDisabled();
    expect(prev).not.toBeDisabled();
  });

  it('clicking Next calls onPageChange with currentPage + 1', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTestId('pagination-next'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('clicking Prev calls onPageChange with currentPage - 1', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTestId('pagination-prev'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('clicking a page number calls onPageChange with that number', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTestId('pagination-page-4'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('clicking First calls onPageChange with 1', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTestId('pagination-first'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('clicking Last calls onPageChange with totalPages', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTestId('pagination-last'));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('marks the current page with aria-current="page" and renders it disabled', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />);
    const current = screen.getByTestId('pagination-page-3');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toBeDisabled();
  });

  it('renders an ellipsis when the page window does not include an adjacent number', () => {
    render(<Pagination currentPage={5} totalPages={10} onPageChange={() => {}} />);
    expect(screen.getAllByTestId('pagination-ellipsis').length).toBeGreaterThan(0);
  });

  it('omits the ellipsis when the page window covers the whole range', () => {
    render(<Pagination currentPage={3} totalPages={4} onPageChange={() => {}} />);
    expect(screen.queryByTestId('pagination-ellipsis')).toBeNull();
  });

  it('clamps currentPage >= totalPages when out of range', () => {
    render(<Pagination currentPage={99} totalPages={5} onPageChange={() => {}} />);
    const current = screen.getByTestId('pagination-page-5');
    expect(current).toHaveAttribute('aria-current', 'page');
    const next = screen.getByTestId('pagination-next') as HTMLButtonElement;
    expect(next).toBeDisabled();
  });

  it('exposes the nav element with an accessible label', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole('navigation', { name: /paginación/i })).toBeInTheDocument();
  });
});

describe('buildPageTokens', () => {
  it('returns [1] for totalPages <= 1', () => {
    expect(buildPageTokens(1, 0)).toEqual([1]);
    expect(buildPageTokens(1, 1)).toEqual([1]);
  });

  it('renders every page when the range is small', () => {
    expect(buildPageTokens(1, 4)).toEqual([1, 2, 3, 4]);
    expect(buildPageTokens(2, 4)).toEqual([1, 2, 3, 4]);
    expect(buildPageTokens(4, 4)).toEqual([1, 2, 3, 4]);
  });

  it('inserts ellipses on both sides of the current page when far from edges', () => {
    // current=5, total=10, sibling=1 → 1, …, 4, 5, 6, …, 10
    expect(buildPageTokens(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  });

  it('does not emit an ellipsis on the left when current is near 1', () => {
    // current=2, total=10, sibling=1 → 1, 2, 3, …, 10
    expect(buildPageTokens(2, 10)).toEqual([1, 2, 3, 'ellipsis', 10]);
  });

  it('does not emit an ellipsis on the right when current is near total', () => {
    // current=9, total=10, sibling=1 → 1, …, 8, 9, 10
    expect(buildPageTokens(9, 10)).toEqual([1, 'ellipsis', 8, 9, 10]);
  });

  it('respects a custom siblingCount', () => {
    // current=5, total=20, sibling=2 → 1, …, 3, 4, 5, 6, 7, …, 20
    expect(buildPageTokens(5, 20, 2)).toEqual([1, 'ellipsis', 3, 4, 5, 6, 7, 'ellipsis', 20]);
  });
});
