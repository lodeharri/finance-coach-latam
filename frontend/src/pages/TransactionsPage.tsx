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
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ForbiddenPage } from './ForbiddenPage';
import { TransactionForm } from '@/molecules/TransactionForm';
import { TransactionTable } from '@/organisms/TransactionTable';
import { useTransactions, useUpdateTransaction, useRecategorizeTransaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { sessionStore } from '@/stores/sessionStore';

export interface TransactionsPageProps {
  apiBaseUrl: string;
}

export function TransactionsPage({ apiBaseUrl }: TransactionsPageProps) {
  const [params] = useSearchParams();
  const session = sessionStore.getState();
  const role = session.role;
  const userId = params.get('userId') ?? session.userId;
  const isAdminTarget = Boolean(params.get('userId')) && role === 'admin';

  const transactions = useTransactions({ apiBaseUrl, userId: userId ?? undefined, limit: 50 });
  const categories = useCategories({ apiBaseUrl });
  const updateTx = useUpdateTransaction({ apiBaseUrl });
  const recategorize = useRecategorizeTransaction({ apiBaseUrl });

  const rows = useMemo(() => transactions.data ?? [], [transactions.data]);
  const cats = useMemo(() => categories.data ?? [], [categories.data]);

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
            {isAdminTarget ? `Transactions for ${userId}` : 'My transactions'}
          </h1>
          <span
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
            data-testid="row-count"
          >
            {String(rows.length).padStart(3, '0')} MOVIMIENTOS
          </span>
        </div>
      </header>
      <TransactionTable
        apiBaseUrl={apiBaseUrl}
        rows={rows}
        categories={cats}
        isLoading={transactions.isPending}
        onOverride={(transactionId, categoryId) => updateTx.mutate({ transactionId, categoryId })}
        onRecategorize={(transactionId) => recategorize.mutate({ transactionId })}
      />
      <section className="mt-2">
        <header className="mb-4 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
            * * *&nbsp;&nbsp;NUEVO MOVIMIENTO
          </span>
          <h2 className="font-display text-lg font-bold text-ink-tinta">Log a new transaction</h2>
        </header>
        <TransactionForm apiBaseUrl={apiBaseUrl} userId={userId} />
      </section>
    </section>
  );
}
