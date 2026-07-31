/**
 * CategoryPill molecule — Litografía del Sur.
 *
 * Slug + name + hex color. Inline color swatch. No API calls.
 */
export interface CategoryPillProps {
  slug: string;
  name: string;
  color: string; // hex like "#1F3FB8"
}

export function CategoryPill({ slug, name, color }: CategoryPillProps) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-sm bg-ink-paper-lift px-2 py-1 font-body text-sm text-ink-tinta border border-ink-paper-press"
      title={slug}
    >
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded-sm border border-ink-tinta-soft"
        style={{ backgroundColor: color }}
      />
      <span>{name}</span>
    </span>
  );
}
