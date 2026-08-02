/**
 * Sidebar organism — Litografía del Sur.
 *
 * Two surfaces:
 *  - Desktop sidebar (hidden on mobile, `md:block` per Tailwind): the editorial
 *    nav rail that lives on the left of the main content.
 *  - Mobile drawer (`mobileOpen=true`): a slide-over that opens from the left
 *    when the hamburger in the masthead is tapped. Backdrop click and Escape
 *    both call onMobileClose. Clicking a link inside the drawer fires
 *    onNavigate AND onMobileClose so the drawer does not linger after the
 *    route changes.
 *
 * The link list is the single source of truth for both surfaces — admin
 * links are filtered by `currentRole` and the active path is highlighted
 * with the cobalt border (signature).
 */
import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import { HexStamp } from '@/atoms/HexStamp';

export interface SidebarProps {
  currentRole: 'admin' | 'user' | null;
  activePath: string;
  onNavigate?: (path: string) => void;
  /** Mobile-only: when true, the slide-over drawer is visible. */
  mobileOpen?: boolean;
  /** Mobile-only: required when mobileOpen is set. Closes the drawer. */
  onMobileClose?: () => void;
}

const links: readonly {
  label: string;
  path: string;
  roles: readonly ('admin' | 'user')[];
  index: string;
}[] = [
  { label: 'Tablero', path: '/dashboard', roles: ['admin', 'user'], index: '01' },
  { label: 'Transacciones', path: '/transactions', roles: ['admin', 'user'], index: '02' },
  { label: 'Cuentas', path: '/accounts', roles: ['admin', 'user'], index: '03' },
  { label: 'Insights', path: '/insights', roles: ['admin', 'user'], index: '04' },
  { label: 'Categorías', path: '/admin/categories', roles: ['admin'], index: '05' },
  { label: 'Usuarios', path: '/admin/users', roles: ['admin'], index: '06' },
] as const;

function NavList({
  currentRole,
  activePath,
  onNavigate,
  onAfterNavigate,
}: {
  currentRole: 'admin' | 'user' | null;
  activePath: string;
  onNavigate?: (path: string) => void;
  onAfterNavigate?: () => void;
}) {
  const visibleLinks = links.filter((link) => currentRole && link.roles.includes(currentRole));
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(path);
    }
    onAfterNavigate?.();
  };
  return (
    <ul className="space-y-1 px-3 py-3">
      {visibleLinks.map((link) => {
        const isActive = activePath === link.path;
        return (
          <li key={link.path}>
            <a
              href={link.path}
              onClick={(event) => handleClick(event, link.path)}
              aria-current={isActive ? 'page' : undefined}
              data-testid={`sidebar-link-${link.path}`}
              className={`group flex items-baseline gap-3 border-l-4 px-3 py-2 font-body text-sm transition-colors ${
                isActive
                  ? 'border-ink-cobalto bg-ink-cobalto/10 text-ink-cobalto'
                  : 'border-transparent text-ink-tinta hover:border-ink-cobalto hover:text-ink-cobalto'
              }`}
            >
              <span
                className={`font-mono text-xs ${
                  isActive ? 'text-ink-cobalto' : 'text-ink-tinta-mute group-hover:text-ink-cobalto'
                }`}
              >
                {link.index}.
              </span>
              <span>{link.label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({
  currentRole,
  activePath,
  onNavigate,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  // Esc closes the mobile drawer. We listen at the document level so the
  // key works regardless of which element inside the drawer is focused.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      <nav
        aria-label="Navegación principal"
        data-testid="app-shell-sidebar"
        className="hidden w-60 shrink-0 border-r border-ink-hairline bg-ink-paper-lift md:block"
      >
        <div
          className="flex flex-col items-start gap-2 px-5 py-6"
          data-testid="sidebar-masthead"
        >
          <HexStamp size="md" title="Litografía del Sur" />
          <span
            data-testid="sidebar-volume"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute"
          >
            VOL. III
          </span>
          <span className="font-display text-sm font-bold lowercase tracking-[0.18em] text-ink-tinta">
            FINANZAS
          </span>
        </div>
        <span aria-hidden="true" className="mx-5 block border-b border-ink-hairline" />
        <NavList
          currentRole={currentRole}
          activePath={activePath}
          {...(onNavigate ? { onNavigate } : {})}
        />
      </nav>
      {mobileOpen ? (
        // The backdrop is a presentational surface; keyboard close is
        // handled by the document-level Esc listener.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          data-testid="mobile-sidebar-backdrop"
          className="fixed inset-0 z-40 bg-ink-tinta/40 md:hidden"
          onClick={onMobileClose}
        >
          {/* The drawer is a dialog (role=dialog). Its onClick is a pure
              stopPropagation bubble guard so clicks on links / the close
              button do not bubble up to the backdrop handler. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
          <aside
            data-testid="mobile-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación principal"
            onClick={(event) => event.stopPropagation()}
            className="h-full w-72 max-w-[80vw] overflow-y-auto border-r border-ink-hairline bg-ink-paper-lift"
          >
            <div className="flex items-baseline justify-between px-5 py-6">
              <div className="flex flex-col items-start gap-2">
                <HexStamp size="md" title="Litografía del Sur" />
                <span
                  data-testid="sidebar-volume"
                  className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute"
                >
                  VOL. III
                </span>
                <span className="font-display text-sm font-bold lowercase tracking-[0.18em] text-ink-tinta">
                  FINANZAS
                </span>
              </div>
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Cerrar menú"
                data-testid="mobile-sidebar-close"
                className="rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-wide text-ink-tinta-soft hover:bg-ink-paper-press focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
              >
                ×
              </button>
            </div>
            <span aria-hidden="true" className="mx-5 block border-b border-ink-hairline" />
            <NavList
              currentRole={currentRole}
              activePath={activePath}
              {...(onNavigate ? { onNavigate } : {})}
              {...(onMobileClose ? { onAfterNavigate: onMobileClose } : {})}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
