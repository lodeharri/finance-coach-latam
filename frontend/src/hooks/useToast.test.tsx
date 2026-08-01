/**
 * useToast hook test suite (RED phase).
 *
 * Validates:
 *  - toasts(state) -> show(message, variant) + dismiss(id)
 *  - 5xx -> auto-retryable toast
 *  - 401 already routed via apiClient.clear(); useToast is for user-actionable feedback
 */
import { act, render } from '@/test/test-utils';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { useToast, toastStore } from './useToast';

const Probe = ({ onReady }: { onReady: (api: ReturnType<typeof useToast>) => void }) => {
  const api = useToast();
  onReady(api);
  return (
    <div>
      <button onClick={() => api.show({ message: 'Saved', variant: 'success' })}>Show</button>
      <button onClick={() => api.dismiss('all')}>Clear</button>
    </div>
  );
};

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset module-level singleton between tests.
    toastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('show() returns a toast id', () => {
    let api!: ReturnType<typeof useToast>;
    render(<Probe onReady={(a) => (api = a)} />);
    let id: string | undefined;
    act(() => {
      id = api.show({ message: 'Hello', variant: 'info' });
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('toasts() returns the active toasts in order', () => {
    let api!: ReturnType<typeof useToast>;
    render(<Probe onReady={(a) => (api = a)} />);
    act(() => {
      api.show({ message: 'One', variant: 'info' });
      api.show({ message: 'Two', variant: 'error' });
    });
    expect(api.toasts()).toHaveLength(2);
  });

  it('dismiss(id) removes a specific toast', () => {
    let api!: ReturnType<typeof useToast>;
    render(<Probe onReady={(a) => (api = a)} />);
    let firstId!: string;
    act(() => {
      firstId = api.show({ message: 'A', variant: 'info' });
      api.show({ message: 'B', variant: 'info' });
    });
    expect(api.toasts()).toHaveLength(2);
    act(() => {
      api.dismiss(firstId);
    });
    expect(api.toasts()).toHaveLength(1);
  });

  it('dismiss("all") clears every toast', () => {
    let api!: ReturnType<typeof useToast>;
    render(<Probe onReady={(a) => (api = a)} />);
    act(() => {
      api.show({ message: 'A', variant: 'info' });
      api.show({ message: 'B', variant: 'info' });
    });
    act(() => api.dismiss('all'));
    expect(api.toasts()).toHaveLength(0);
  });

  it('showRetryable() registers a toast with onRetry callback', () => {
    let api!: ReturnType<typeof useToast>;
    render(<Probe onReady={(a) => (api = a)} />);
    const onRetry = vi.fn();
    act(() => {
      api.showRetryable({ message: 'Network failed', onRetry });
    });
    const toast = api.toasts()[0]!;
    expect(toast.variant).toBe('retryable');
    expect(typeof toast.onRetry).toBe('function');
    toast.onRetry?.();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});