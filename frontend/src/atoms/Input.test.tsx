/**
 * Input atom — TDD test suite (RED phase).
 *
 * Controlled input. Supports aria-invalid + aria-describedby.
 * Atoms MUST have no state, no API calls.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('is controlled: renders the current value and fires onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input value="hello" onChange={onChange} aria-label="Name" />);
    const input = screen.getByLabelText('Name') as HTMLInputElement;
    expect(input.value).toBe('hello');
    await user.type(input, 'x');
    expect(onChange).toHaveBeenCalled();
  });

  it('exposes aria-invalid when invalid is true', () => {
    render(<Input value="" onChange={() => {}} aria-label="Email" invalid />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when invalid is false or unset', () => {
    render(<Input value="" onChange={() => {}} aria-label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('exposes aria-describedby pointing at the given id', () => {
    render(
      <>
        <Input
          value=""
          onChange={() => {}}
          aria-label="Email"
          describedById="email-error"
        />
        <span id="email-error">Invalid</span>
      </>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('supports type="email" and type="password"', () => {
    const { rerender } = render(
      <Input type="email" value="" onChange={() => {}} aria-label="Email" />,
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');

    rerender(
      <Input type="password" value="" onChange={() => {}} aria-label="Password" />,
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Input value="" onChange={() => {}} aria-label="Locked" disabled />);
    expect(screen.getByLabelText('Locked')).toBeDisabled();
  });

  it('defaults to the default variant (pressed-paper background)', () => {
    render(<Input value="" onChange={() => {}} aria-label="X" />);
    expect(screen.getByLabelText('X')).toHaveAttribute('data-variant', 'default');
    expect(screen.getByLabelText('X').className).toMatch(/bg-ink-paper-press/);
  });

  it('editorial variant uses hairline-bottom-only treatment', () => {
    render(<Input variant="editorial" value="" onChange={() => {}} aria-label="Editorial" />);
    const input = screen.getByLabelText('Editorial');
    expect(input).toHaveAttribute('data-variant', 'editorial');
    expect(input.className).toMatch(/border-b border-ink-tinta/);
    expect(input.className).toMatch(/bg-transparent/);
  });

  it('editorial variant still surfaces aria-invalid', () => {
    render(
      <Input variant="editorial" value="x" onChange={() => {}} aria-label="Editorial" invalid />,
    );
    expect(screen.getByLabelText('Editorial')).toHaveAttribute('aria-invalid', 'true');
  });
});
