/**
 * ConfirmDialog molecule — Litografía del Sur.
 *
 * Thin confirmation dialog built on top of the Modal molecule. Two-button
 * layout (Cancel + Confirm). The confirm button uses the destructive variant
 * because confirm-and-delete is the most common usage; consumers can pass
 * `variant="primary"` for non-destructive confirmations.
 *
 * Molecules have no API calls; consumers wire confirm via the onConfirm prop.
 */
import { Button } from '@/atoms/Button';
import { Modal } from './Modal';

export type ConfirmVariant = 'destructive' | 'primary';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body text — can include the target entity name, e.g. "¿Eliminar a Jane?" */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  isConfirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  confirmVariant = 'destructive',
  isConfirming = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="font-body text-md text-ink-tinta" data-testid="confirm-dialog-message">
        {message}
      </p>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={onClose}
          disabled={isConfirming}
          data-testid="confirm-dialog-cancel"
        >
          {cancelLabel}
        </Button>
        <Button
          variant={confirmVariant}
          size="md"
          onClick={onConfirm}
          disabled={isConfirming}
          data-testid="confirm-dialog-confirm"
        >
          {isConfirming ? 'Procesando…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
