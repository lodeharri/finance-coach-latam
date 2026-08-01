/**
 * TransactionsPage — Litografía del Sur.
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
    <section className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-tinta">
          {isAdminTarget ? `Transactions for ${userId}` : 'My transactions'}
        </h1>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
      </header>
      <TransactionTable
        apiBaseUrl={apiBaseUrl}
        rows={rows}
        categories={cats}
        isLoading={transactions.isPending}
        onOverride={(transactionId, categoryId) => updateTx.mutate({ transactionId, categoryId })}
        onRecategorize={(transactionId) => recategorize.mutate({ transactionId })}
      />
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-ink-tinta">Log a new transaction</h2>
        <TransactionForm apiBaseUrl={apiBaseUrl} userId={userId} />
      </section>
    </section>
  );
}