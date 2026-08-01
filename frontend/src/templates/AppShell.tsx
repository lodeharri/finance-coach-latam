import type { ReactNode } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { HexStamp } from '@/atoms/HexStamp';
import { LogoutButton } from '@/atoms/LogoutButton';
import { RoleBadge } from '@/molecules/RoleBadge';
import { Sidebar } from '@/organisms/Sidebar';
import { ToastHost } from '@/organisms/ToastHost';
import { sessionStore } from '@/stores/sessionStore';

export interface AppShellProps {
  pageName?: string;
  role?: 'admin' | 'user';
  children?: ReactNode;
}

function formatToday(): string {
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()] ?? ''} ${now.getFullYear()}`;
}

/**
 * Map a path to a folio number. The "volume" stays constant (III), the folio
 * increments per route. Editorial conceit: the masthead reads as a publication
 * of folios, not a generic top-bar.
 */
function folioFor(path: string): string {
  if (path === '/dashboard') return 'FOLIO 04';
  if (path === '/transactions') return 'FOLIO 05';
  if (path === '/accounts') return 'FOLIO 06';
  if (path === '/insights') return 'FOLIO 07';
  if (path === '/admin/categories') return 'FOLIO 12';
  if (path === '/admin/users') return 'FOLIO 13';
  return 'FOLIO 00';
}

function derivePageName(path: string): string {
  if (path === '/dashboard') return 'Tablero';
  if (path === '/transactions') return 'Transacciones';
  if (path === '/accounts') return 'Cuentas';
  if (path === '/insights') return 'Insights';
  if (path === '/admin/categories') return 'Categorías';
  if (path === '/admin/users') return 'Usuarios';
  return '';
}

export function AppShell({ pageName, role, children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRole = role ?? sessionStore.getState().role ?? null;
  const resolvedPageName = pageName ?? derivePageName(location.pathname);
  const folio = folioFor(location.pathname);

  return (
    <div
      data-testid="app-shell"
      className="min-h-screen bg-ink-paper text-ink-tinta font-body"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, var(--ink-paper-grain) 1px, transparent 0)',
        backgroundSize: '8px 8px',
      }}
    >
      <header
        data-testid="app-shell-masthead"
        className="flex items-center justify-between gap-6 border-b border-ink-hairline bg-ink-cobalto px-12 text-ink-paper"
        style={{ minHeight: '64px' }}
      >
        <div className="flex items-baseline gap-4">
          <HexStamp size="md" />
          <span
            data-testid="app-shell-folio"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-paper/70"
          >
            VOL. III · {folio}
          </span>
          <h1
            className="font-display text-xl font-bold tracking-tight"
            data-testid="app-shell-page-name"
          >
            {resolvedPageName}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span
            data-testid="app-shell-date"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-paper/90"
            aria-label="Today's date"
          >
            {formatToday()}
          </span>
          {currentRole ? <RoleBadge role={currentRole} /> : null}
          <LogoutButton />
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar currentRole={currentRole} activePath={location.pathname} onNavigate={navigate} />
        <main
          data-testid="app-shell-main"
          className="min-w-0 flex-1 px-12 py-10 md:pr-20"
        >
          {children ?? <Outlet />}
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
