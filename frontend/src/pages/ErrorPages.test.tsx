/**
 * ForbiddenPage + NotFoundPage test suite (RED phase).
 *
 * Neither page makes API calls. Both render a clear message + a back link.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { ForbiddenPage } from './ForbiddenPage';
import { NotFoundPage } from './NotFoundPage';

function wrap(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('ForbiddenPage', () => {
  it('renders a 403 heading and explanation', () => {
    wrap(<ForbiddenPage />);
    expect(screen.getByRole('heading', { name: /403|denegado/i })).toBeInTheDocument();
  });

  it('has a link back to /dashboard', () => {
    wrap(<ForbiddenPage />);
    const link = screen.getByRole('link', { name: /volver al tablero/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });
});

describe('NotFoundPage', () => {
  it('renders a 404 heading', () => {
    wrap(<NotFoundPage />);
    expect(screen.getByRole('heading', { name: /404|no encontrada/i })).toBeInTheDocument();
  });

  it('has a link back to /dashboard', () => {
    wrap(<NotFoundPage />);
    const link = screen.getByRole('link', { name: /volver al tablero/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });
});