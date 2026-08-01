/**
 * Toast molecule — TDD test suite (RED phase).
 *
 * Variants: info | success | error | retryable.
 * role="status" for non-error; role="alert" for error.
 * Auto-dismiss for non-error (timer-driven).
 * Respects prefers-reduced-motion (transitions disabled via tokens.css).
 * Molecules may carry transient local state for the dismiss timer.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '../test/test-utils';
import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('info variant uses role="status"', () => {
    render(<Toast id="t1" variant="info" message="Saved" onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('success variant uses role="status"', () => {
    render(<Toast id="t2" variant="success" message="Done" onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Done');
  });

  it('error variant uses role="alert"', () => {
    render(<Toast id="t3" variant="error" message="Failed" onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('retryable variant uses role="alert" and exposes Reintentar button', () => {
    render(
      <Toast
        id="t4"
        variant="retryable"
        message="Falló la red"
        onDismiss={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falló la red');
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('non-error toasts auto-dismiss after the default timeout', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t5" variant="info" message="Soon gone" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onDismiss).toHaveBeenCalledWith('t5');
  });

  it('error toasts do NOT auto-dismiss (require explicit close)', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t6" variant="error" message="Stays" onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('Reintentar button invokes onRetry with the toast id', () => {
    const onRetry = vi.fn();
    render(
      <Toast
        id="t7"
        variant="retryable"
        message="Reintentar"
        onDismiss={() => {}}
        onRetry={onRetry}
      />,
    );
    act(() => {
      screen.getByRole('button', { name: /reintentar/i }).click();
    });
    expect(onRetry).toHaveBeenCalledWith('t7');
  });

  it('Cerrar button invokes onDismiss with the toast id', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t8" variant="info" message="Hola" onDismiss={onDismiss} />);
    act(() => {
      vi.clearAllTimers();
    });
    act(() => {
      screen.getByRole('button', { name: /cerrar/i }).click();
    });
    expect(onDismiss).toHaveBeenCalledWith('t8');
  });
});
