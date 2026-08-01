/**
 * RecentTransactionsList organism — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `ACTIVIDAD · ÚLTIMOS 5` in mono caps above the list.
 * - Each row navigates to /transactions on click.
 * - Ledger line number prefix preserved from TransactionTable (N.º 0001).
 * - Hairline border-b on each row.
 */
import { useNavigate } from 'react-router-dom';
import { useTransactions } from '@/hooks/useTransactions';
import { AmountText } from '@/molecules/AmountText';
import { Badge } from '@/atoms/Badge';

export interface RecentTransactionsListProps {
  apiBaseUrl: string;
  userId?: string | undefined;
}

function formatLine(index: number): string {
  return `N.º ${String(index + 1).padStart(4, '0')}`;
}

export function RecentTransactionsList({ apiBaseUrl, userId }: RecentTransactionsListProps) {
  const navigate = useNavigate();
  const transactions = useTransactions({ apiBaseUrl, userId, limit: 5 });
  const rows = transactions.data ?? [];

  if (rows.length === 0) {
    return (
      <div data-testid="recent-empty" className="font-body text-sm text-ink-tinta-soft">
        Sin movimientos aún. Registra tu primera transacción para verla aquí.
      </div>
    );
  }

  return (
    <section data-testid="recent-list-section">
      <header className="mb-3 flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute"
          data-testid="recent-kicker"
        >
          ACTIVIDAD · ÚLTIMOS 5
        </span>
        <span className="font-mono text-xs text-ink-tinta-mute">{rows.length} / 5</span>
      </header>
      <ul className="flex flex-col" data-testid="recent-list">
        {rows.map((tx, index) => {
          const variant =
            tx.status === 'CATEGORIZED'
              ? 'positivo'
              : tx.status === 'PENDING'
                ? 'alerta'
                : 'fallo';
          return (
            <li
              key={tx.id}
              data-testid={`recent-row-${tx.id}`}
              className="flex items-center gap-3 border-b border-ink-hairline py-2"
            >
              <span className="font-mono text-xs text-ink-tinta-mute">{formatLine(index)}</span>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="flex flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
              >
                <span className="font-body text-md text-ink-tinta">{tx.merchant}</span>
                <Badge variant={variant}>{tx.status}</Badge>
              </button>
              <AmountText amountCents={tx.amountCents} currency="COP" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
