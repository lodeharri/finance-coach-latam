/**
 * CategorySelect molecule — Litografía del Sur.
 *
 * Dropdown reusing CategoryPill for option labels. Keyboard accessible
 * (Tab/Enter/Space), aria-expanded on the trigger. Calls onChange with the
 * selected categoryId.
 */
import { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { CategoryPill } from './CategoryPill';

export interface CategorySelectProps {
  apiBaseUrl: string;
  value?: string | undefined;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}

export function CategorySelect({ apiBaseUrl, value, onChange, disabled, defaultOpen = false }: CategorySelectProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { data: categories } = useCategories({ apiBaseUrl });
  const selected = categories?.find((c) => c.id === value);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-sm bg-ink-paper-lift px-2 py-1 font-body text-sm text-ink-tinta border border-ink-paper-press focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
      >
        {selected ? (
          <CategoryPill slug={selected.slug} name={selected.name} color={selected.color} />
        ) : (
          <span className="text-ink-tinta-mute">Elegir categoría…</span>
        )}
      </button>
      {open && categories ? (
        <ul
          role="listbox"
          aria-label="Categories"
          className="absolute z-10 mt-1 max-h-60 w-64 overflow-auto rounded-sm border border-ink-paper-press bg-ink-paper shadow"
        >
          {categories.map((c) => (
            <li key={c.id} role="option" aria-selected={c.id === value}>
              <button
                type="button"
                className="flex w-full items-center px-2 py-1.5 hover:bg-ink-paper-lift focus:bg-ink-paper-lift focus:outline-none"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <CategoryPill slug={c.slug} name={c.name} color={c.color} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}