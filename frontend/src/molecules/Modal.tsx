/**
 * Modal molecule — Litografía del Sur.
 *
 * Accessible dialog built on a `role="dialog" aria-modal="true"` div. We do
 * not depend on the HTML `<dialog>` element because JSDOM does not implement
 * `showModal()`; the div-based approach is the cross-environment standard.
 *
 * Contract (pinned by Modal.test.tsx):
 *  - `open=false` renders nothing.
 *  - `open=true` mounts the dialog, locks body scroll, focuses the dialog
 *    surface so screen readers read the title.
 *  - Backdrop click → `onClose()`.
 *  - Escape key → `onClose()`.
 *  - Clicking the dialog surface itself does NOT close.
 *  - Body scroll is restored on close.
 *
 * Molecules have no state beyond what the contract requires; consumers control
 * `open` and supply the title / body / actions as children.
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog) {
      // Focus the dialog itself so screen readers announce the title.
      dialog.focus();
    }
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- The backdrop is a presentational surface; keyboard close is handled by the document-level Esc listener in the effect above.
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-tinta/40 px-4 py-8"
      onClick={onClose}
    >
      {/* The dialog surface has role=dialog and aria-modal. The onClick handler
          is purely a stopPropagation bubble guard; keyboard close is handled
          by the document-level Esc listener in the effect above. jsx-a11y
          considers role="dialog" non-interactive for the purposes of
          no-noninteractive-element-interactions, but we need the bubble guard
          to keep the backdrop handler from firing when the user clicks
          inside the dialog (e.g. text selection, form fields). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="modal-dialog"
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="max-h-[90vh] w-full max-w-lg overflow-auto border border-ink-paper-press bg-ink-paper text-ink-tinta shadow-lg focus:outline-none"
      >
        <header className="flex items-baseline justify-between border-b border-ink-hairline px-6 py-4">
          <h2 className="font-display text-lg font-bold lowercase tracking-[0.18em] text-ink-tinta">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            data-testid="modal-close-button"
            className="rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-wide text-ink-tinta-soft hover:bg-ink-paper-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
          >
            ×
          </button>
        </header>
        <div className="flex flex-col gap-5 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
