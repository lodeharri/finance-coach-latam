/**
 * CategoryForm molecule — Litografía del Sur (REQ-FF-CATEGORIES-CRUD).
 *
 * Editorial form for creating or editing a category. Used inside the admin
 * CategoriesAdminPage modals. Slug is editable on create (immutable on
 * edit — the backend contract locks the slug once the row exists).
 *
 * Molecules have no API calls; consumers wire submit via the onSubmit prop.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/atoms/Button';
import { FormField } from './FormField';

export interface CategoryFormValues {
  slug: string;
  name: string;
  color: string;
}

export interface CategoryFormProps {
  /** When provided, the form edits this category (slug becomes read-only). */
  initial?: CategoryFormValues;
  /** Disable the slug field (e.g. on edit). Default false on create. */
  slugLocked?: boolean;
  /** Submit handler — receives the validated payload. */
  onSubmit: (values: CategoryFormValues) => void;
  /** Optional: while a mutation is in flight. */
  isSubmitting?: boolean;
  /** Label for the primary action. Defaults to "Crear categoría" / "Guardar cambios". */
  submitLabel?: string;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function CategoryForm({
  initial,
  slugLocked = false,
  onSubmit,
  isSubmitting = false,
  submitLabel,
}: CategoryFormProps) {
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#1F3FB8');
  const [errors, setErrors] = useState<{ slug?: string; name?: string; color?: string; form?: string }>({});

  // Reset the form whenever the initial values change (so re-opening the
  // modal for a different category starts from that category's data).
  useEffect(() => {
    setSlug(initial?.slug ?? '');
    setName(initial?.name ?? '');
    setColor(initial?.color ?? '#1F3FB8');
    setErrors({});
  }, [initial?.slug, initial?.name, initial?.color]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) next.slug = 'El slug es obligatorio.';
    if (!name.trim()) next.name = 'El nombre es obligatorio.';
    if (!HEX_COLOR.test(color)) next.color = 'El color debe ser un hex como #AABBCC.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit({ slug: trimmedSlug, name: name.trim(), color });
  };

  const primaryLabel =
    submitLabel ?? (initial ? 'Guardar cambios' : 'Crear categoría');

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="category-form">
      <FormField
        id="cat-slug"
        label="Slug"
        variant="editorial"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="transporte"
        required
        disabled={slugLocked}
        error={errors.slug}
      />
      <FormField
        id="cat-name"
        label="Nombre"
        variant="editorial"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Transporte"
        required
        error={errors.name}
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cat-color"
          className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft"
        >
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="cat-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer border border-ink-paper-press bg-transparent p-0"
          />
          <span className="font-mono text-xs text-ink-tinta-soft">{color}</span>
        </div>
        {errors.color ? (
          <span role="alert" className="font-body text-sm text-ink-negativo">
            {errors.color}
          </span>
        ) : null}
      </div>
      {errors.form ? (
        <span role="alert" className="font-body text-sm text-ink-negativo">
          {errors.form}
        </span>
      ) : null}
      <div>
        <Button type="submit" disabled={isSubmitting} data-testid="category-submit">
          {isSubmitting ? 'Guardando…' : primaryLabel}
        </Button>
      </div>
    </form>
  );
}
