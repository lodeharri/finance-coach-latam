/**
 * TransactionsPage — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `LIBRO DIARIO · 2026` in mono caps above the page title.
 * - Row count strip `042 MOVIMIENTOS` in mono on the right of the header.
 * - Range indicator `Mostrando N · PÁGINA X` below the header.
 *
 * Pagination: PAGE_SIZE rows per page, offset-based navigation through
 * the Pagination molecule. Backend does not return a total count, so
 * "Next" is shown whenever the current page is full (result.length ===
 * PAGE_SIZE), and totalPages is computed as currentPage + 1 while the user
 * keeps clicking Next. Visiting a specific page directly is supported
 * through the page tokens.
 *
 * The create form is mounted inside a modal opened from a header button.
 * Closing the modal on success unmounts the form and naturally resets all
 * field state for the next entry.
 *
 * Per-transaction polling: when the create mutation resolves with a
 * PENDING row, we capture the new id in `trackingId` so the page can poll
 * the row until the categorizer worker writes a terminal status. The
 * hook self-arms a 90s timeout and surfaces any fetch error so the page
 * can show a recovery toast.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/atoms/Button';
import { ForbiddenPage } from './ForbiddenPage';
import { Modal } from '@/molecules/Modal';
import { TransactionForm } from '@/molecules/TransactionForm';
import { TransactionTable } from '@/organisms/TransactionTable';
import { Pagination } from '@/molecules/Pagination';
import { useTransactions, useUpdateTransaction, useRecategorizeTransaction, useCategorizationStatus } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { sessionStore } from '@/stores/sessionStore';
import { useToast } from '@/hooks/useToast';
import type { Transaction } from '@/services/types';

export const PAGE_SIZE = 25;

export interface TransactionsPageProps {
  apiBaseUrl: string;
}

export function TransactionsPage({ apiBaseUrl }: TransactionsPageProps) {
  const [params] = useSearchParams();
  const session = sessionStore.getState();
  const role = session.role;
  const userId = params.get('userId') ?? session.userId;
  const isAdminTarget = Boolean(params.get('userId')) && role === 'admin';

  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const transactions = useTransactions({
    apiBaseUrl,
    userId: userId ?? undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const categories = useCategories({ apiBaseUrl });
  const updateTx = useUpdateTransaction({ apiBaseUrl });
  const recategorize = useRecategorizeTransaction({ apiBaseUrl });
  const queryClient = useQueryClient();
  const { show: showToast } = useToast();
  const categorization = useCategorizationStatus(trackingId);

  // Listen for create-mutation success events and capture the new
  // transaction id so the polling hook starts tracking it. Only fires
  // for PENDING rows (terminal statuses don't need polling).
  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const data = event.mutation.state.data as Transaction | undefined;
      const variables = event.mutation.state.variables;
      if (
        !data ||
        data.status !== 'PENDING' ||
        !variables ||
        typeof variables !== 'object' ||
        !('merchant' in variables) ||
        !('accountId' in variables) ||
        !('amountCents' in variables) ||
        !('occurredAt' in variables)
      ) {
        return;
      }
      setTrackingId(data.id);
    });
  }, [queryClient]);

  // React to polling state changes. CATEGORIZED → success toast and stop
  // tracking. FAILED → error toast (no auto-retry) and stop tracking.
  // Timeout → "slow categorizer" toast, stop tracking so the user can
  // click Recategorize. Network/404 error → toast with the error message.
  useEffect(() => {
    const data = categorization.data;
    if (data && data.status === 'CATEGORIZED') {
      showToast({ variant: 'success', message: `Transacción categorizada: ${data.merchant}` });
      setTrackingId(null);
    } else if (data && data.status === 'FAILED') {
      showToast({
        variant: 'error',
        message: `No se pudo categorizar ${data.merchant}. Intenta recategorizarla manualmente.`,
      });
      setTrackingId(null);
    }
  }, [categorization.data, showToast]);

  useEffect(() => {
    if (categorization.isTimeout) {
      showToast({
        variant: 'error',
        message: 'La categorización está tardando más de lo normal. Probá recategorizar manualmente.',
      });
      setTrackingId(null);
    }
  }, [categorization.isTimeout, showToast]);

  useEffect(() => {
    const err = categorization.error;
    if (err) {
      showToast({
        variant: 'error',
        message: `Error al verificar la categorización: ${err.message}. Probá recategorizar manualmente.`,
      });
      setTrackingId(null);
    }
  }, [categorization.error, showToast]);

  const rows = useMemo(() => transactions.data ?? [], [transactions.data]);
  const cats = useMemo(() => categories.data ?? [], [categories.data]);

  // No total count from backend: show Next whenever the current page is
  // full. The user can keep paging until a short page comes back, at which
  // point the Next button disappears (this row count is the source of
  // truth for "is there more?").
  const isFullPage = rows.length === PAGE_SIZE;
  const totalPages = Math.max(currentPage, currentPage + (isFullPage ? 1 : 0));
  const startIndex = rows.length === 0 ? 0 : offset + 1;
  const endIndex = offset + rows.length;

  if (!userId) {
    return <ForbiddenPage />;
  }

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2" data-testid="transactions-page-header">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          LIBRO DIARIO · 2026
        </span>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">
            {isAdminTarget ? `Transacciones de ${userId}` : 'Mis transacciones'}
          </h1>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <span
              className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
              data-testid="row-count"
            >
              {String(rows.length).padStart(3, '0')} MOVIMIENTOS
            </span>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
              data-testid="transactions-new-button"
            >
              + Nueva transacción
            </Button>
          </div>
        </div>
      </header>
      <p
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
        data-testid="transactions-range"
      >
        Mostrando {startIndex}–{endIndex} · PÁGINA {currentPage} de {totalPages}
      </p>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <TransactionTable
          apiBaseUrl={apiBaseUrl}
          rows={rows}
          categories={cats}
          isLoading={transactions.isPending}
          onOverride={(transactionId, categoryId) => updateTx.mutate({ transactionId, categoryId })}
          onRecategorize={(transactionId) => recategorize.mutate({ transactionId })}
        />
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva transacción"
      >
        <TransactionForm
          apiBaseUrl={apiBaseUrl}
          userId={userId}
          onCreated={() => setCreateOpen(false)}
        />
      </Modal>
    </section>
  );
}
