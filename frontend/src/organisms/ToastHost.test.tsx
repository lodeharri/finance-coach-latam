/**
 * ToastHost organism test suite (RED phase).
 *
 * Renders all toasts from toastStore. Each toast has the right role/aria-live.
 */
import { render, screen, act } from '@/test/test-utils';
import { describe, expect, it, beforeEach } from 'vitest';
import { ToastHost } from './ToastHost';
import { toastStore } from '@/hooks/useToast';

describe('ToastHost', () => {
  beforeEach(() => {
    toastStore.setState({ toasts: [] });
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastHost />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a status toast for info variant', () => {
    act(() => {
      toastStore.getState().show({ message: 'Saved', variant: 'info' });
    });
    render(<ToastHost />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('renders an alert toast for error variant', () => {
    act(() => {
      toastStore.getState().show({ message: 'Failed', variant: 'error' });
    });
    render(<ToastHost />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('renders multiple toasts in order', () => {
    act(() => {
      toastStore.getState().show({ message: 'A', variant: 'info' });
      toastStore.getState().show({ message: 'B', variant: 'error' });
    });
    render(<ToastHost />);
    expect(screen.getByRole('status')).toHaveTextContent('A');
    expect(screen.getByRole('alert')).toHaveTextContent('B');
  });

  it('exposes the host container with data-testid', () => {
    act(() => {
      toastStore.getState().show({ message: 'X', variant: 'info' });
    });
    render(<ToastHost />);
    expect(screen.getByTestId('toast-host')).toBeInTheDocument();
  });
});