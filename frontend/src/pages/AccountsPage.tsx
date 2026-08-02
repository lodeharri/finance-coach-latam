/**
 * AccountsPage — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `RELACIÓN DE CUENTAS · 2026` above the page title.
 * - Type glyph strip `BANK | CASH | CARD` per row (signature element).
 * - Row count strip `N.º 03 · CUENTAS` in mono on the right of the header.
 *
 * Lists accounts for the current user (or admin-targeted userId via query
 * string). The create form is mounted inside a Modal opened from a header
 * button; on success the form unmounts, which resets all field state for
 * the next entry.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/atoms/Button';
import { ForbiddenPage } from './ForbiddenPage';
import { Modal } from '@/molecules/Modal';
import { AccountForm } from '@/molecules/AccountForm';
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
  const [createOpen, setCreateOpen] = useState(false);

  if (!userId) {
    return <ForbiddenPage />;
  }

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2" data-testid="accounts-page-header">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          RELACIÓN DE CUENTAS · 2026
        </span>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">
            {isAdminTarget ? `Cuentas de ${userId}` : 'Mis cuentas'}
          </h1>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <span
              className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute"
              data-testid="row-count"
            >
              N.º {String(rows.length).padStart(3, '0')} · CUENTAS
            </span>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
              data-testid="accounts-new-button"
            >
              + Nueva cuenta
            </Button>
          </div>
        </div>
      </header>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full border-collapse font-body text-md" data-testid="accounts-table">
        <thead>
          <tr className="border-b-2 border-ink-tinta text-left">
            <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
              N.º
            </th>
            <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
              Nombre
            </th>
            <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
              Tipo
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, index) => (
            <tr
              key={a.id}
              className="border-b border-ink-hairline"
              data-testid={`acc-row-${a.id}`}
            >
              <td className="py-2 pr-4 font-mono text-xs text-ink-tinta-mute">
                N.º {String(index + 1).padStart(4, '0')}
              </td>
              <td className="py-2 pr-4">{a.name}</td>
              <td className="py-2 pr-4">
                <span
                  className="inline-flex items-center gap-2 rounded-sm border border-ink-paper-press bg-ink-paper-lift px-2 py-1 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta"
                  data-testid={`acc-type-${a.id}`}
                >
                  <span aria-hidden="true" className="block h-2 w-2 bg-ink-cobalto" />
                  {a.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rows.length === 0 ? (
        <section
          className="rounded-sm border border-dashed border-ink-paper-press bg-ink-paper-lift p-6"
          data-testid="empty-state"
        >
          <p className="font-display text-lg italic text-ink-tinta">Ninguna cuenta aún.</p>
          <p className="mt-1 font-body text-sm text-ink-tinta-soft">
            Agrega tu primera cuenta para empezar a registrar movimientos.
          </p>
        </section>
      ) : null}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva cuenta">
        <AccountForm
          apiBaseUrl={apiBaseUrl}
          userId={userId}
          onCreated={() => setCreateOpen(false)}
        />
      </Modal>
    </section>
  );
}
