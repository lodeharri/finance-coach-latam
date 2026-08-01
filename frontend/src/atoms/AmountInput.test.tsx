/**
 * AmountInput atom tests (REQ-FFC-TX-CREATE-FORM, REQ-FFC-TX-AMOUNT-DISPLAY).
 *
 * Colocated because the atom has logic (controlled input + cents-only entry).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { AmountInput } from './AmountInput';

describe('AmountInput', () => {
  it('renders a text input with inputMode="numeric" for cents-only entry', () => {
    render(<AmountInput value="" onValueChange={() => {}} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('inputMode', 'numeric');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('strips non-digit characters (only positive integer cents)', () => {
    let value = '';
    render(<AmountInput value={value} onValueChange={(v) => (value = v)} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '1234' } });
    expect(value).toBe('1234');

    fireEvent.change(input, { target: { value: '12.34' } });
    expect(value).toBe('1234');

    fireEvent.change(input, { target: { value: '-500' } });
    expect(value).toBe('500');

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(value).toBe('');
  });

  it('applies an aria-invalid attribute when invalid', () => {
    render(<AmountInput value="x" onValueChange={() => {}} invalid describedById="err" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'err');
  });

  it('renders the value verbatim when controlled', () => {
    render(<AmountInput value="4242" onValueChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('4242');
  });

  it('uses tabular lining figures via font-mono', () => {
    render(<AmountInput value="4242" onValueChange={() => {}} />);
    expect(screen.getByRole('textbox').className).toContain('font-mono');
  });
});