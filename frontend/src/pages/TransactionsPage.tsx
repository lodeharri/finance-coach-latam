/**
 * TransactionsPage — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `LIBRO DIARIO · 2026` in mono caps above the page title.
 * - Row count strip `042 MOVIMIENTOS` in mono on the right of the header.
 * - Asterism caption above the form section.
 *
 * Lists transactions for the current user (or admin-targeted userId via
 * query string). Composes TransactionTable + TransactionForm. ForbiddenPage
 * for 403, loading/empty/error states reuse foundation patterns.
 *
 * Pagination: PAGE_SIZE rows per page, offset-based navigation through
 * the Pagination molecule. Backend does not return a total count, so
 * "Next" is shown whenever the current page is full (result.length ===
 * PAGE_SIZE), and totalPages is computed as currentPage + 1 while the user
 * keeps clicking Next. Visiting a specific page directly is supported
 * through the page tokens.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ForbiddenPage } from './ForbiddenPage';
import { TransactionForm } from '@/molecules/TransactionForm';
import { TransactionTable } from '@/organisms/TransactionTable';
import { Pagination } from '@/molecules/Pagination';
import { useTransactions, useUpdateTransaction, useRecategorizeTransaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { sessionStore } from '@/stores/sessionStore';

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
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">
            {isAdminTarget ? `Transacciones de ${userId}` : 'Mis transacciones'}
          </h1>
          <span
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
            data-testid="row-count"
          >
            {String(rows.length).padStart(3, '0')} MOVIMIENTOS
          </span>
        </div>
      </header>
      <p
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
        data-testid="transactions-range"
      >
        Mostrando {startIndex}–{endIndex} · PÁGINA {currentPage} de {totalPages}
      </p>
      <TransactionTable
        apiBaseUrl={apiBaseUrl}
        rows={rows}
        categories={cats}
        isLoading={transactions.isPending}
        onOverride={(transactionId, categoryId) => updateTx.mutate({ transactionId, categoryId })}
        onRecategorize={(transactionId) => recategorize.mutate({ transactionId })}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      <section className="mt-2">
        <header className="mb-4 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
            * * *&nbsp;&nbsp;NUEVO MOVIMIENTO
          </span>
          <h2 className="font-display text-lg font-bold text-ink-tinta">Registrar transacción</h2>
        </header>
        <TransactionForm apiBaseUrl={apiBaseUrl} userId={userId} />
      </section>
    </section>
  );
}
