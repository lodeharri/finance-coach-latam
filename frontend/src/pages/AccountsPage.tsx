/**
 * AccountsPage — Litografía del Sur.
 *
 * Lists accounts for the current user (or admin-targeted userId via query
 * string). Signature: type glyph strip `BANK|CASH|CARD` per row.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ForbiddenPage } from './ForbiddenPage';
import { AccountForm } from '@/molecules/AccountForm';
import { Badge } from '@/atoms/Badge';
import { useAccounts } from '@/hooks/useAccounts';
import { sessionStore } from '@/stores/sessionStore';

export interface AccountsPageProps {
  apiBaseUrl: string;
}

export function AccountsPage({ apiBaseUrl }: AccountsPageProps) {
  const [params] = useSearchParams();
  const session = sessionStore.getState();
  const role = session.role;
  const userId = params.get('userId') ?? session.userId;
  const isAdminTarget = Boolean(params.get('userId')) && role === 'admin';
  const accounts = useAccounts({ apiBaseUrl, userId: userId ?? undefined });
  const rows = useMemo(() => accounts.data ?? [], [accounts.data]);

  if (!userId) {
    return <ForbiddenPage />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-tinta">
          {isAdminTarget ? `Accounts for ${userId}` : 'My accounts'}
        </h1>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
          {rows.length} {rows.length === 1 ? 'account' : 'accounts'}
        </span>
      </header>
      <table className="w-full border-collapse font-body text-md" data-testid="accounts-table">
        <thead>
          <tr className="border-b-2 border-ink-tinta text-left">
            <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-wide text-ink-tinta-mute">Name</th>
            <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-wide text-ink-tinta-mute">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-ink-paper-press" data-testid={`acc-row-${a.id}`}>
              <td className="py-2 pr-4">{a.name}</td>
              <td className="py-2 pr-4">
                <Badge variant="neutral">{a.type}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="font-body text-sm text-ink-tinta-soft" data-testid="empty-state">
          No accounts yet. Add your first one to start logging transactions.
        </p>
      ) : null}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-ink-tinta">Add a new account</h2>
        <AccountForm apiBaseUrl={apiBaseUrl} userId={userId} />
      </section>
    </section>
  );
}