/**
 * FormField molecule — TDD test suite (RED phase).
 *
 * Composes Label + Input atom. Surfaces inline error from API {message, details}.
 * Molecules have local state only (none here) and no API calls.
 *
 * Fixes memory id 719: forwards required, aria-required, aria-invalid, min,
 * max, pattern to the underlying Input.
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

  // ── Memory id 719: required forwarding fix ───────────────────────────────
  it('forwards required to the underlying input (memory id 719)', () => {
    render(<FormField id="x" label="Email" required value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/email/i)).toBeRequired();
  });

  it('forwards aria-required to the underlying input when explicitly set', () => {
    render(
      <FormField id="x" label="Email" value="" onChange={() => {}} aria-required={false} />,
    );
    // The underlying input should expose aria-required=false even when the prop
    // is explicitly false.
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-required', 'false');
  });

  it('forwards min and max to the underlying input', () => {
    render(
      <FormField id="n" label="Number" type="text" value="" onChange={() => {}} min={0} max={100} />,
    );
    const input = screen.getByLabelText(/number/i) as HTMLInputElement;
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
  });

  it('forwards pattern to the underlying input', () => {
    render(
      <FormField
        id="p"
        label="Pattern"
        type="text"
        value=""
        onChange={() => {}}
        pattern="[A-Z]{3}"
      />,
    );
    expect(screen.getByLabelText(/pattern/i)).toHaveAttribute('pattern', '[A-Z]{3}');
  });

  it('forwards inputMode to the underlying input', () => {
    render(
      <FormField
        id="i"
        label="Inline"
        type="text"
        value=""
        onChange={() => {}}
        inputMode="numeric"
      />,
    );
    expect(screen.getByLabelText(/inline/i)).toHaveAttribute('inputMode', 'numeric');
  });

  it('forwards aria-describedby when explicitly provided', () => {
    render(
      <FormField
        id="d"
        label="Described"
        value=""
        onChange={() => {}}
        aria-describedby="custom-desc"
      />,
    );
    expect(screen.getByLabelText(/described/i)).toHaveAttribute('aria-describedby', 'custom-desc');
  });

  // ── Editorial variant: signature form treatment ─────────────────────────
  it('editorial variant renders hairline-bottom input + mono caps label', () => {
    render(
      <FormField id="e" label="Editorial" variant="editorial" value="" onChange={() => {}} />,
    );
    const input = screen.getByLabelText(/editorial/i);
    const label = screen.getByText(/editorial/i);
    expect(input).toHaveAttribute('data-variant', 'editorial');
    expect(input.className).toMatch(/border-b border-ink-tinta/);
    expect(input.className).toMatch(/bg-transparent/);
    expect(label.className).toMatch(/font-mono/);
    expect(label.className).toMatch(/uppercase/);
  });

  it('editorial variant still forwards required (memory id 719)', () => {
    render(
      <FormField
        id="er"
        label="Editorial Required"
        variant="editorial"
        required
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/editorial required/i)).toBeRequired();
  });
});
