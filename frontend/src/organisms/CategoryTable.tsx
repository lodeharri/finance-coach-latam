/**
 * CategoryTable organism — Litografía del Sur.
 *
 * Lists categories via useCategories. Each row exposes Edit + Delete actions
 * that delegate to the parent (so the page can open its own modals). When no
 * `onEdit` callback is supplied, the Edit button is hidden (graceful
 * degradation for callers that haven't wired the edit flow yet).
 *
 * Optimistic delete with 409-restore (REQ-FF-CATEGORIES-CRUD). Conflict
 * surfaces as an inline message per row, not a toast.
 *
 * Organisms orchestrate remote data through hooks; they have NO direct fetch calls.
 */
import { useState } from 'react';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import { CategoryPill } from '@/molecules/CategoryPill';
import { Button } from '@/atoms/Button';
import { Spinner } from '@/atoms/Spinner';
import type { Category } from '@/services/types';

export interface CategoryTableProps {
  apiBaseUrl: string;
  /** Called when the user clicks Editar on a row. */
  onEdit?: (category: Category) => void;
  /** Called when the user clicks Eliminar on a row. */
  onDeleteRequest?: (category: Category) => void;
}

export function CategoryTable({ apiBaseUrl, onEdit, onDeleteRequest }: CategoryTableProps) {
  const categories = useCategories({ apiBaseUrl });
  const remove = useDeleteCategory({ apiBaseUrl });
  const [conflictById, setConflictById] = useState<Record<string, string>>({});

  if (categories.isPending) {
    return (
      <div className="flex items-center gap-3" data-testid="category-table-loading">
        <Spinner aria-label="Loading categories" />
        <span className="font-mono text-xs uppercase tracking-wide text-ink-tinta-soft">
          N.º loading
        </span>
      </div>
    );
  }

  if (categories.isError) {
    return (
      <p className="font-body text-sm text-ink-negativo" role="alert">
        Failed to load categories: {categories.error?.message ?? 'unknown error'}
      </p>
    );
  }

  const list = categories.data ?? [];
  if (list.length === 0) {
    return (
      <p className="font-body text-sm text-ink-tinta-soft" data-testid="empty-state">
        Aún no hay categorías. Crea la primera para empezar.
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
                <div className="flex justify-end gap-2">
                  {onEdit ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEdit(c)}
                      data-testid={`category-edit-${c.id}`}
                    >
                      Editar
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (onDeleteRequest) {
                        // Defer to the parent — it owns the confirmation
                        // modal. The parent calls `useDeleteCategory`
                        // directly when the user confirms.
                        setConflictById((m) => {
                          const { [c.id]: _drop, ...rest } = m;
                          return rest;
                        });
                        onDeleteRequest(c);
                        return;
                      }
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
                    data-testid={`category-delete-${c.id}`}
                  >
                    Eliminar
                  </Button>
                </div>
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
