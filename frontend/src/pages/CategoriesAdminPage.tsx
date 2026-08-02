/**
 * CategoriesAdminPage — Litografía del Sur.
 *
 * Admin-only page that renders the CategoryTable organism and orchestrates
 * the three modal flows: create, edit, and delete-confirmation. Admin role
 * gating is enforced by RequireRole in the router.
 */
import { useState } from 'react';
import { Button } from '@/atoms/Button';
import { CategoryForm } from '@/molecules/CategoryForm';
import { ConfirmDialog } from '@/molecules/ConfirmDialog';
import { Modal } from '@/molecules/Modal';
import { CategoryTable } from '@/organisms/CategoryTable';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/useCategories';
import type { Category } from '@/services/types';

export interface CategoriesAdminPageProps {
  apiBaseUrl: string;
}

export function CategoriesAdminPage({ apiBaseUrl }: CategoriesAdminPageProps) {
  // Hooks are called unconditionally so the cache stays warm while the
  // modals open/close.
  useCategories({ apiBaseUrl });
  const create = useCreateCategory({ apiBaseUrl });
  const update = useUpdateCategory({ apiBaseUrl });
  const remove = useDeleteCategory({ apiBaseUrl });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [error, setError] = useState<string | undefined>();

  const closeCreate = () => {
    setCreateOpen(false);
    setError(undefined);
  };
  const closeEdit = () => {
    setEditing(null);
    setError(undefined);
  };
  const closeDelete = () => {
    setDeleting(null);
  };

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2" data-testid="categories-page-header">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          TIPOS · 2026
        </span>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">Categorías</h1>
          <Button
            variant="primary"
            size="md"
            onClick={() => setCreateOpen(true)}
            data-testid="categories-new-button"
          >
            + Nueva categoría
          </Button>
        </div>
      </header>
      {error ? (
        <p role="alert" className="font-body text-sm text-ink-negativo" data-testid="categories-error">
          {error}
        </p>
      ) : null}
      <CategoryTable
        apiBaseUrl={apiBaseUrl}
        onEdit={(c) => {
          setEditing(c);
          setError(undefined);
        }}
        onDeleteRequest={(c) => setDeleting(c)}
      />

      <Modal open={createOpen} onClose={closeCreate} title="Nueva categoría">
        <CategoryForm
          onSubmit={(values) => {
            create.mutate(values, {
              onSuccess: () => closeCreate(),
              onError: (err) =>
                setError(err instanceof Error ? err.message : 'No se pudo crear la categoría.'),
            });
          }}
          isSubmitting={create.isPending}
          submitLabel="Crear categoría"
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={closeEdit}
        title={`Editar "${editing?.name ?? ''}"`}
      >
        {editing ? (
          <CategoryForm
            initial={{ slug: editing.slug, name: editing.name, color: editing.color }}
            slugLocked
            onSubmit={(values) => {
              update.mutate(
                { id: editing.id, patch: { name: values.name, color: values.color } },
                {
                  onSuccess: () => closeEdit(),
                  onError: (err) =>
                    setError(
                      err instanceof Error ? err.message : 'No se pudo actualizar la categoría.',
                    ),
                },
              );
            }}
            isSubmitting={update.isPending}
            submitLabel="Guardar cambios"
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar categoría"
        message={
          deleting
            ? `¿Eliminar "${deleting.name}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        confirmVariant="destructive"
        isConfirming={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          remove.mutate(target.id, {
            onSuccess: () => closeDelete(),
            onError: (err) => {
              setError(err instanceof Error ? err.message : 'No se pudo eliminar la categoría.');
              closeDelete();
            },
          });
        }}
        onClose={closeDelete}
      />
    </section>
  );
}
