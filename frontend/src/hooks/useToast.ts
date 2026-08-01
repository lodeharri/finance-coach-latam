/**
 * useToast — Toast queue for transient feedback.
 *
 * Used by apiClient 5xx / network-error responses and by user actions that
 * need confirmation. Toasts auto-dismiss on their own timer (handled by the
 * Toast molecule); this hook only owns the queue.
 */
import { create } from 'zustand';
import type { ToastVariant } from '@/molecules/Toast';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  onRetry?: () => void;
}

export interface ShowArgs {
  message: string;
  variant: ToastVariant;
}

export interface ShowRetryableArgs {
  message: string;
  onRetry: () => void;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `t-${Date.now()}-${counter}`;
}

export interface ToastStore {
  toasts: ToastItem[];
  show: (args: ShowArgs) => string;
  showRetryable: (args: ShowRetryableArgs) => string;
  dismiss: (id: string) => void;
}

export const toastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (args) => {
    const id = nextId();
    set((s) => ({ toasts: [...s.toasts, { id, variant: args.variant, message: args.message }] }));
    return id;
  },
  showRetryable: (args) => {
    const id = nextId();
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id, variant: 'retryable', message: args.message, onRetry: args.onRetry },
      ],
    }));
    return id;
  },
  dismiss: (id) => {
    if (id === 'all') set({ toasts: [] });
    else set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export function useToast() {
  const toasts = toastStore((s) => s.toasts);
  const show = toastStore((s) => s.show);
  const showRetryable = toastStore((s) => s.showRetryable);
  const dismiss = toastStore((s) => s.dismiss);
  return {
    toasts: (): ToastItem[] => toasts,
    show,
    showRetryable,
    dismiss,
  };
}