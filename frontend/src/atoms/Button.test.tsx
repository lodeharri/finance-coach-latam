/**
 * Button atom — TDD test suite (RED phase).
 *
 * Variants: primary | secondary | destructive.
 * Sizes: sm | md | lg.
 * Focus ring must use --ink-cobalto.
 * Atoms MUST have no state, no API calls.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and applies default md/primary classes', () => {
    render(<Button onClick={() => {}}>Save</Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeInTheDocument();
    // primary variant = cobalt ink background
    expect(btn.className).toMatch(/bg-ink-cobalto|bg-\[var\(--ink-cobalto\)\]/);
  });

  it('renders secondary variant with paper-press background', () => {
    render(
      <Button variant="secondary" onClick={() => {}}>
        Cancel
      </Button>,
    );
    expect(screen.getByRole('button').className).toMatch(/bg-ink-paper-press/);
  });

  it('renders destructive variant with negativo ink', () => {
    render(
      <Button variant="destructive" onClick={() => {}}>
        Delete
      </Button>,
    );
    expect(screen.getByRole('button').className).toMatch(/bg-ink-negativo/);
  });

  it('supports sm and lg sizes', () => {
    const { rerender } = render(
      <Button size="sm" onClick={() => {}}>
        Small
      </Button>,
    );
    expect(screen.getByRole('button').className).toMatch(/h-8|text-sm/);

    rerender(
      <Button size="lg" onClick={() => {}}>
        Large
      </Button>,
    );
    expect(screen.getByRole('button').className).toMatch(/h-12|text-lg/);
  });

  it('is disabled when disabled prop is set and ignores clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick when enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses cobalt focus ring (--ink-cobalto) for keyboard focus', () => {
    render(<Button onClick={() => {}}>Focused</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/focus:ring-ink-cobalto|focus-visible:ring-ink-cobalto/);
  });

  it('renders as button element by default (no API calls, no state)', () => {
    render(<Button onClick={() => {}}>Native</Button>);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });
});
