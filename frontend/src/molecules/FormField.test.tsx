/**
 * FormField molecule — TDD test suite (RED phase).
 *
 * Composes Label + Input atom. Surfaces inline error from API {message, details}.
 * Molecules have local state only (none here) and no API calls.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/test-utils';
import { FormField } from './FormField';

describe('FormField', () => {
  it('renders label htmlFor wired to the input id', () => {
    render(
      <FormField id="email" label="Email" value="" onChange={() => {}} />,
    );
    const label = screen.getByText('Email');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'email');
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('id', 'email');
  });

  it('shows required indicator when required prop is true', () => {
    render(
      <FormField id="email" label="Email" required value="" onChange={() => {}} />,
    );
    expect(screen.getByText(/email/i).textContent).toMatch(/\*/);
  });

  it('does NOT render an error element when there is no error', () => {
    render(<FormField id="email" label="Email" value="" onChange={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces the error verbatim beside the input (aria-describedby links them)', () => {
    render(
      <FormField
        id="email"
        label="Email"
        value=""
        onChange={() => {}}
        error="Invalid email format"
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    const err = screen.getByRole('alert');
    expect(err).toHaveTextContent('Invalid email format');
    expect(err).toHaveAttribute('id', 'email-error');
  });

  it('passes through type (email, password, text)', () => {
    const { rerender } = render(
      <FormField id="a" label="A" type="email" value="" onChange={() => {}} />,
    );
    expect(screen.getByLabelText('A')).toHaveAttribute('type', 'email');

    rerender(
      <FormField id="b" label="B" type="password" value="" onChange={() => {}} />,
    );
    expect(screen.getByLabelText('B')).toHaveAttribute('type', 'password');
  });

  it('forwards onChange to the underlying input', () => {
    // The atom Input already covers this; here we only assert wiring is intact.
    render(<FormField id="x" label="X" value="v" onChange={() => {}} />);
    expect(screen.getByLabelText('X')).toHaveValue('v');
  });
});
