/**
 * atoms.trivial.test.tsx — shared test file for trivial atoms.
 *
 * Per the user-mandated TDD policy (applied 2026-07-31):
 * - Trivial atoms = pure presentational, no state, no/minimal callbacks beyond onClick.
 * - These three (Label, Badge, Spinner) share ONE test file.
 * - Behavior parity with the prior colocated suites MUST be preserved (no regression
 *   in coverage or assertion quality).
 *
 * Components in this file:
 * - Label: htmlFor + required indicator, no API.
 * - Badge: named signal variants (positivo/negativo/fallo/alerta/neutral), optional
 *   inline SVG icon that is force-hidden from screen readers.
 * - Spinner: aria-busy, aria-label, motion-reduce friendly.
 *
 * Atoms with REAL behavior keep their colocated tests:
 * - Button.test.tsx (variants, sizes, disabled, focus ring)
 * - Input.test.tsx (controlled, aria-invalid, aria-describedby, types)
 * - HexStamp.test.tsx (signature element — hexagonal lattice, aria-hidden)
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Label } from './Label';
import { Badge } from './Badge';
import { Spinner } from './Spinner';

describe('Label', () => {
  it('renders text and htmlFor associates with the control', () => {
    render(
      <>
        <Label htmlFor="first-name">First name</Label>
        <input id="first-name" />
      </>,
    );
    expect(screen.getByText('First name')).toBeInTheDocument();
    expect(screen.getByText('First name').tagName).toBe('LABEL');
  });

  it('shows a required indicator when required prop is true', () => {
    render(
      <Label htmlFor="email" required>
        Email
      </Label>,
    );
    expect(screen.getByText(/email/i)).toHaveTextContent(/\*/);
  });

  it('does not show required indicator when required prop is omitted', () => {
    render(<Label htmlFor="email">Email</Label>);
    expect(screen.getByText(/email/i).textContent).not.toMatch(/\*/);
  });

  it('forwards additional html props', () => {
    render(
      <Label htmlFor="x" data-testid="custom-label">
        Field
      </Label>,
    );
    expect(screen.getByTestId('custom-label')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge variant="positivo">CATEGORIZADO</Badge>);
    expect(screen.getByText('CATEGORIZADO')).toBeInTheDocument();
  });

  it('positivo variant uses positivo token', () => {
    render(<Badge variant="positivo">CATEGORIZADO</Badge>);
    expect(screen.getByText('CATEGORIZADO').className).toMatch(/bg-ink-positivo/);
  });

  it('negativo variant uses negativo token', () => {
    render(<Badge variant="negativo">RECHAZADO</Badge>);
    expect(screen.getByText('RECHAZADO').className).toMatch(/bg-ink-negativo/);
  });

  it('fallo variant uses fallo token (FAILED state)', () => {
    render(<Badge variant="fallo">FALLIDO</Badge>);
    expect(screen.getByText('FALLIDO').className).toMatch(/bg-ink-fallo/);
  });

  it('alerta variant uses alerta token (PENDING state)', () => {
    render(<Badge variant="alerta">PENDIENTE</Badge>);
    expect(screen.getByText('PENDIENTE').className).toMatch(/bg-ink-alerta/);
  });

  it('neutral variant uses paper-press token', () => {
    render(<Badge variant="neutral">BORRADOR</Badge>);
    expect(screen.getByText('BORRADOR').className).toMatch(/bg-ink-paper-press/);
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
        CON ÍCONO
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
        CON ÍCONO
      </Badge>,
    );
    expect(screen.getByTestId('badge-icon')).toHaveAttribute('aria-hidden', 'true');
  });
});

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