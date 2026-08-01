/**
 * TransactionTable organism — Litografía del Sur.
 *
 * Editorial treatment:
 * - Engraved 2 px tinta thead rule (signature, dense).
 * - Ledger line numbers "N.º 0042" prefix on each row, in JetBrains Mono xs.
 * - Currency-formatted amount via AmountText. PENDING|FAILED status chip via
 *   Badge. CATEGORIZED pill click opens CategorySelect override dropdown.
 *   Recategorize button on PENDING|FAILED.
 */
import { useState } from 'react';
import type { Transaction } from '@/services/types';
import type { Category } from '@/services/types';
import { AmountText } from '@/molecules/AmountText';
import { CategoryPill } from '@/molecules/CategoryPill';
import { CategorySelect } from '@/molecules/CategorySelect';
import { Badge } from '@/atoms/Badge';

function formatLedgerLine(index: number, total: number): string {
  const width = String(total).length;
  return `N.º ${String(index + 1).padStart(Math.max(width, 4), '0')}`;
}

export interface TransactionTableProps {
  apiBaseUrl: string;
  rows: ReadonlyArray<Transaction>;
  categories: ReadonlyArray<Category>;
  onOverride: (transactionId: string, categoryId: string) => void;
  onRecategorize: (transactionId: string) => void;
  isLoading?: boolean;
}

export function TransactionTable({
  apiBaseUrl,
  rows,
  categories,
  onOverride,
  onRecategorize,
  isLoading = false,
}: TransactionTableProps) {
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const total = rows.length;

  if (isLoading) {
    return (
      <div role="status" aria-busy="true" className="font-body text-sm text-ink-tinta-soft">
        Cargando transacciones…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
        className="rounded-sm border border-dashed border-ink-paper-press bg-ink-paper-lift p-6"
        data-testid="empty-state"
      >
        <p className="font-display text-lg italic text-ink-tinta">Ningún movimiento aún.</p>
        <p className="mt-1 font-body text-sm text-ink-tinta-soft">
          Registra tu primera transacción para verla aquí.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse font-body text-md" data-testid="transaction-table">
      <thead>
        <tr className="border-b-2 border-ink-tinta text-left">
          <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
            N.º
          </th>
          <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
            Fecha
          </th>
          <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
            Comercio
          </th>
          <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
            Categoría
          </th>
          <th scope="col" className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
            Monto
          </th>
          <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
            Estado
          </th>
          <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta">
            Acciones
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const cat = categories.find((c) => c.id === row.categoryId);
          const statusVariant =
            row.status === 'CATEGORIZED'
              ? 'positivo'
              : row.status === 'PENDING'
                ? 'alerta'
                : 'fallo';
          const statusLabel =
            row.status === 'CATEGORIZED'
              ? 'CATEGORIZADO'
              : row.status === 'PENDING'
                ? 'PENDIENTE'
                : 'FALLIDO';
          return (
            <tr
              key={row.id}
              className="border-b border-ink-hairline"
              data-testid={`tx-row-${row.id}`}
            >
              <td className="py-2 pr-4 font-mono text-xs text-ink-tinta-mute">
                {formatLedgerLine(index, total)}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-ink-tinta-soft">
                {new Date(row.occurredAt).toISOString().slice(0, 10)}
              </td>
              <td className="py-2 pr-4">{row.merchant}</td>
              <td className="py-2 pr-4">
                {overrideFor === row.id ? (
                  <CategorySelect
                    apiBaseUrl={apiBaseUrl}
                    value={row.categoryId ?? undefined}
                    onChange={(categoryId) => {
                      onOverride(row.id, categoryId);
                      setOverrideFor(null);
                    }}
                    defaultOpen
                  />
                ) : cat ? (
                  <button
                    type="button"
                    onClick={() => setOverrideFor(row.id)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
                    aria-label={`Cambiar categoría de ${row.merchant}`}
                  >
                    <CategoryPill slug={cat.slug} name={cat.name} color={cat.color} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOverrideFor(row.id)}
                    className="font-body text-sm text-ink-tinta-mute underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
                  >
                    Asignar…
                  </button>
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                <AmountText
                  amountCents={row.amountCents}
                  currency="COP"
                  signal={row.amountCents >= 0 ? undefined : 'negativo'}
                />
              </td>
              <td className="py-2 pr-4">
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </td>
              <td className="py-2 pr-4">
                {row.status !== 'CATEGORIZED' ? (
                  <button
                    type="button"
                    onClick={() => onRecategorize(row.id)}
                    className="font-body text-sm text-ink-cobalto hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
                  >
                    Recategorizar
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
