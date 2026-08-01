/**
 * Pagination molecule — Litografía del Sur.
 *
 * Editorial treatment:
 * - Mono caps prev/next/page buttons (signature form treatment).
 * - Disabled state uses paper-press + cursor-not-allowed.
 * - Active page shows in cobalt-on-paper (matches the period selector on
 *   InsightsPage).
 * - Ellipsis between distant page groups ("1 … 4 5 6 … 9").
 *
 * The component is purely presentational — it does not fetch, store
 * state, or know the data set. The parent (page or organism) owns
 * currentPage, totalPages, and the onPageChange handler.
 */
export interface PaginationProps {
  /** 1-indexed current page. */
  currentPage: number;
  /** Total number of pages. Must be ≥ 1; if 0 the molecule renders nothing. */
  totalPages: number;
  /** Fires when the user clicks a page number, prev, or next. */
  onPageChange: (page: number) => void;
  /** Visible window around the current page. Default 1. */
  siblingCount?: number;
  /** Accessible label for the nav element. Default "Paginación". */
  ariaLabel?: string;
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += 1) out.push(i);
  return out;
}

// Pure helper for tests.
// eslint-disable-next-line react-refresh/only-export-components
export function buildPageTokens(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): Array<number | 'ellipsis'> {
  if (totalPages <= 1) return [1];
  // Compact pagination rule: when the total set is small enough that the
  // first/last + current window covers every page, just emit every page.
  // 2*sibling + 3 covers the first / last / current / ±sibling slots with
  // a one-page buffer on either side — enough to absorb the "near edge"
  // case where the window naturally reaches a boundary.
  if (totalPages <= 2 * siblingCount + 3) {
    return range(1, totalPages);
  }
  // Otherwise: always show first, last, current ± siblingCount. With
  // ellipses between non-adjacent groups.
  const include = new Set<number>([1, totalPages, currentPage]);
  for (let i = 1; i <= siblingCount; i += 1) {
    include.add(currentPage - i);
    include.add(currentPage + i);
  }
  const sorted = [...include].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const tokens: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev !== 0 && p - prev > 1) tokens.push('ellipsis');
    tokens.push(p);
    prev = p;
  }
  return tokens;
}

const BASE_BUTTON =
  'inline-flex h-9 min-w-[2.25rem] items-center justify-center px-2 font-mono text-xs uppercase tracking-[0.2em] ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto';

const ENABLED_CLASSES =
  'border border-ink-paper-press bg-ink-paper-lift text-ink-tinta hover:border-ink-cobalto hover:text-ink-cobalto';

const DISABLED_CLASSES =
  'border border-ink-paper-press bg-ink-paper-press text-ink-tinta-mute cursor-not-allowed pointer-events-none';

const ACTIVE_CLASSES = 'border border-ink-cobalto bg-ink-cobalto text-ink-paper';

function paginationButtonClasses(enabled: boolean, active: boolean): string {
  if (active) return `${BASE_BUTTON} ${ACTIVE_CLASSES}`;
  return `${BASE_BUTTON} ${enabled ? ENABLED_CLASSES : DISABLED_CLASSES}`;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  ariaLabel = 'Paginación',
}: PaginationProps) {
  if (totalPages <= 0) return null;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const tokens = buildPageTokens(safePage, totalPages, siblingCount);
  const atFirst = safePage <= 1;
  const atLast = safePage >= totalPages;

  return (
    <nav
      data-testid="pagination"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-px overflow-hidden rounded-sm border border-ink-paper-press bg-ink-paper-press"
    >
      <button
        type="button"
        aria-label="Primera página"
        data-testid="pagination-first"
        onClick={() => onPageChange(1)}
        disabled={atFirst}
        className={paginationButtonClasses(!atFirst, false)}
      >
        «
      </button>
      <button
        type="button"
        aria-label="Página anterior"
        data-testid="pagination-prev"
        onClick={() => onPageChange(safePage - 1)}
        disabled={atFirst}
        className={paginationButtonClasses(!atFirst, false)}
      >
        ‹
      </button>
      {tokens.map((token, idx) =>
        token === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            data-testid="pagination-ellipsis"
            aria-hidden="true"
            className="inline-flex h-9 min-w-[2.25rem] items-center justify-center bg-ink-paper-lift px-2 font-mono text-xs text-ink-tinta-mute"
          >
            …
          </span>
        ) : (
          <button
            key={`page-${token}`}
            type="button"
            aria-label={`Página ${token}`}
            aria-current={token === safePage ? 'page' : undefined}
            data-testid={`pagination-page-${token}`}
            onClick={() => onPageChange(token)}
            disabled={token === safePage}
            className={paginationButtonClasses(true, token === safePage)}
          >
            {token}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Página siguiente"
        data-testid="pagination-next"
        onClick={() => onPageChange(safePage + 1)}
        disabled={atLast}
        className={paginationButtonClasses(!atLast, false)}
      >
        ›
      </button>
      <button
        type="button"
        aria-label="Última página"
        data-testid="pagination-last"
        onClick={() => onPageChange(totalPages)}
        disabled={atLast}
        className={paginationButtonClasses(!atLast, false)}
      >
        »
      </button>
    </nav>
  );
}
