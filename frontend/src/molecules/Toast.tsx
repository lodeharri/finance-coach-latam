/**
 * Toast molecule — Litografía del Sur.
 *
 * Variants: info | success | error | retryable.
 * role="status" for non-error; role="alert" for error/retryable.
 * Auto-dismiss for non-error (default 4s). Reduced motion handled by tokens.css.
 * Molecules may own transient local state for the dismiss timer.
 */
import { useEffect } from 'react';

export type ToastVariant = 'info' | 'success' | 'error' | 'retryable';

export interface ToastProps {
  id: string;
  variant: ToastVariant;
  message: string;
  onDismiss: (id: string) => void;
  onRetry?: (id: string) => void;
  /** ms; default 4000. Ignored for error variant. */
  durationMs?: number;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: 'bg-ink-paper-lift text-ink-tinta border-ink-paper-press',
  success: 'bg-ink-positivo text-ink-paper border-ink-positivo',
  error: 'bg-ink-fallo text-ink-paper border-ink-fallo',
  retryable: 'bg-ink-negativo text-ink-paper border-ink-negativo',
};

export function Toast({
  id,
  variant,
  message,
  onDismiss,
  onRetry,
  durationMs = 4000,
}: ToastProps) {
  const isAlert = variant === 'error' || variant === 'retryable';
  const role = isAlert ? 'alert' : 'status';
  const classes =
    `flex items-center gap-3 rounded border px-4 py-2 shadow-sm ` +
    `font-body text-sm transition-opacity duration-entrance ` +
    `${VARIANT_CLASSES[variant]}`;

  useEffect(() => {
    if (isAlert) return;
    const t = setTimeout(() => onDismiss(id), durationMs);
    return () => clearTimeout(t);
  }, [id, durationMs, isAlert, onDismiss]);

  return (
    <div className={classes} role={role} aria-live={isAlert ? 'assertive' : 'polite'}>
      <span className="flex-1">{message}</span>
      {variant === 'retryable' && onRetry ? (
        <button
          type="button"
          onClick={() => onRetry(id)}
          className="rounded-sm bg-ink-paper px-2 py-1 font-mono text-xs uppercase tracking-wide text-ink-tinta hover:bg-ink-paper-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
        >
          Retry
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Close"
        className="rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-wide opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
      >
        ×
      </button>
    </div>
  );
}
