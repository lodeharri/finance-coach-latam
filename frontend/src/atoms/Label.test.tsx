/**
 * Label atom — TDD test suite (RED phase).
 *
 * Uses htmlFor to associate with a control. Optional required indicator.
 * Atoms MUST have no state, no API calls.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Label } from './Label';

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
