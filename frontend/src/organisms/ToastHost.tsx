/**
 * ToastHost organism — Litografía del Sur.
 *
 * Mounts every active toast from toastStore at the bottom-right of the viewport.
 * Mounted once in AppShell so all pages get transient feedback.
 *
 * Organisms orchestrate; here they only render the toast queue, no API calls.
 */
import { toastStore } from '@/hooks/useToast';
import { Toast } from '@/molecules/Toast';

export function ToastHost() {
  const toasts = toastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  const dismiss = toastStore.getState().dismiss;
  return (
    <div
      data-testid="toast-host"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          id={t.id}
          variant={t.variant}
          message={t.message}
          onDismiss={dismiss}
          {...(t.onRetry ? { onRetry: () => { t.onRetry?.(); dismiss(t.id); } } : {})}
        />
      ))}
    </div>
  );
}