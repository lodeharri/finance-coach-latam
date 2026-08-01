/**
 * CategoryTable organism — Litografía del Sur.
 *
 * Lists categories via useCategories. Each row is a CategoryPill + Delete button.
 * Optimistic delete with 409-restore (REQ-FF-CATEGORIES-CRUD). Conflict surfaces
 * as an inline message per row, not a toast.
 *
 * Organisms orchestrate remote data through hooks; they have NO direct fetch calls.
 */
import { useState } from 'react';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import { CategoryPill } from '@/molecules/CategoryPill';
import { Button } from '@/atoms/Button';
import { Spinner } from '@/atoms/Spinner';

export interface CategoryTableProps {
  apiBaseUrl: string;
}

export function CategoryTable({ apiBaseUrl }: CategoryTableProps) {
  const categories = useCategories({ apiBaseUrl });
  const remove = useDeleteCategory({ apiBaseUrl });
  const [conflictById, setConflictById] = useState<Record<string, string>>({});

  if (categories.isPending) {
    return (
      <div className="flex items-center gap-3" data-testid="category-table-loading">
        <Spinner aria-label="Cargando categorías" />
        <span className="font-mono text-xs uppercase tracking-wide text-ink-tinta-soft">
          N.º cargando
        </span>
      </div>
    );
  }

  if (categories.isError) {
    return (
      <p className="font-body text-sm text-ink-negativo" role="alert">
        Error al cargar categorías: {categories.error?.message ?? 'error desconocido'}
      </p>
    );
  }

  const list = categories.data ?? [];
  if (list.length === 0) {
    return (
      <p className="font-body text-sm text-ink-tinta-soft" data-testid="empty-state">
        Aún no hay categorías. Crea una para empezar.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse" data-testid="category-table">
      <thead>
        <tr>
          <th className="border-b border-ink-paper-press py-2 text-left font-mono text-xs uppercase tracking-wide text-ink-tinta-soft">
            Slug
          </th>
          <th className="border-b border-ink-paper-press py-2 text-left font-mono text-xs uppercase tracking-wide text-ink-tinta-soft">
            Nombre
          </th>
          <th className="border-b border-ink-paper-press py-2 text-left font-mono text-xs uppercase tracking-wide text-ink-tinta-soft">
            Color
          </th>
          <th className="border-b border-ink-paper-press py-2 text-right font-mono text-xs uppercase tracking-wide text-ink-tinta-soft">
            Acciones
          </th>
        </tr>
      </thead>
      <tbody>
        {list.map((c) => {
          const conflict = conflictById[c.id];
          return (
            <tr key={c.id} className="border-b border-ink-paper-press" data-testid={`category-row-${c.id}`}>
              <td className="py-2 pr-4 font-mono text-xs text-ink-tinta-mute">{c.slug}</td>
              <td className="py-2 pr-4">
                <CategoryPill slug={c.slug} name={c.name} color={c.color} />
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-ink-tinta-soft">{c.color}</td>
              <td className="py-2 text-right">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConflictById((m) => {
                      const { [c.id]: _drop, ...rest } = m;
                      return rest;
                    });
                    remove.mutate(c.id, {
                      onError: (err) => {
                        setConflictById((m) => ({ ...m, [c.id]: err.message }));
                      },
                    });
                  }}
                  disabled={remove.isPending}
                >
                  Eliminar
                </Button>
                {conflict ? (
                  <p
                    role="alert"
                    className="mt-1 font-body text-xs text-ink-negativo"
                    data-testid={`category-conflict-${c.id}`}
                  >
                    {conflict}
                  </p>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}