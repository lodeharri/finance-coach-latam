/**
 * Badge atom — TDD test suite (RED phase).
 *
 * Color variants: positivo | negativo | fallo | alerta | neutral.
 * Optional inline SVG icon. Atoms have no state, no API.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge variant="positivo">CATEGORIZED</Badge>);
    expect(screen.getByText('CATEGORIZED')).toBeInTheDocument();
  });

  it('positivo variant uses positivo token', () => {
    render(<Badge variant="positivo">CATEGORIZED</Badge>);
    expect(screen.getByText('CATEGORIZED').className).toMatch(/bg-ink-positivo/);
  });

  it('negativo variant uses negativo token', () => {
    render(<Badge variant="negativo">DECLINED</Badge>);
    expect(screen.getByText('DECLINED').className).toMatch(/bg-ink-negativo/);
  });

  it('fallo variant uses fallo token (FAILED state)', () => {
    render(<Badge variant="fallo">FAILED</Badge>);
    expect(screen.getByText('FAILED').className).toMatch(/bg-ink-fallo/);
  });

  it('alerta variant uses alerta token (PENDING state)', () => {
    render(<Badge variant="alerta">PENDING</Badge>);
    expect(screen.getByText('PENDING').className).toMatch(/bg-ink-alerta/);
  });

  it('neutral variant uses paper-press token', () => {
    render(<Badge variant="neutral">DRAFT</Badge>);
    expect(screen.getByText('DRAFT').className).toMatch(/bg-ink-paper-press/);
  });

  it('renders an inline SVG icon when provided', () => {
    render(
      <Badge
        variant="positivo"
        icon={
          <svg data-testid="badge-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
          </svg>
        }
      >
        WITH ICON
      </Badge>,
    );
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
    expect(screen.getByTestId('badge-icon').tagName.toLowerCase()).toBe('svg');
  });

  it('icon is aria-hidden', () => {
    render(
      <Badge
        variant="positivo"
        icon={
          <svg data-testid="badge-icon" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" />
          </svg>
        }
      >
        WITH ICON
      </Badge>,
    );
    expect(screen.getByTestId('badge-icon')).toHaveAttribute('aria-hidden', 'true');
  });
});
