/**
 * Modal molecule tests (REQ-FF-ADMIN-CRUD-MODAL).
 *
 * Molecules are pure presentational pieces: they own their a11y and dismiss
 * contract but never make API calls. These tests pin the modal contract that
 * every admin/user form modal will rely on:
 *   - Closed by default (renders nothing visible).
 *   - Renders the dialog container with role="dialog" + aria-modal="true"
 *     when open.
 *   - Backdrop click triggers onClose.
 *   - Escape key triggers onClose.
 *   - Backdrop click on the dialog surface itself does NOT close.
 *   - Body scroll is locked while open.
 *   - Renders children + title verbatim.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { Modal } from './Modal';

afterEach(() => {
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('renders nothing when open is false', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with role=dialog and aria-modal=true when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Hello');
  });

  it('renders the children verbatim inside the dialog', () => {
    render(
      <Modal open onClose={vi.fn()} title="Hello">
        <p data-testid="modal-body">Body</p>
      </Modal>,
    );
    expect(screen.getByTestId('modal-body')).toHaveTextContent('Body');
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when the dialog surface is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose on Escape when closed', () => {
    const onClose = vi.fn();
    render(
      <Modal open={false} onClose={onClose} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks body scroll while open and restores it when closed', () => {
    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders a close button with accessible label', () => {
    render(
      <Modal open onClose={vi.fn()} title="Hello">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
  });
});
