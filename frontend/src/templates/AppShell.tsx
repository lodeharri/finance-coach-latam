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

  return (
    <div className="min-h-screen bg-ink-paper text-ink-tinta font-body">
      <header data-testid="app-shell-masthead" className="flex items-center justify-between bg-ink-cobalto px-6 text-ink-paper" style={{ height: '48px' }}>
        <h1 className="font-display text-lg font-bold tracking-wide" data-testid="app-shell-page-name">{resolvedPageName}</h1>
        <div className="flex items-center gap-3">
          {currentRole ? <RoleBadge role={currentRole} /> : null}
          <span data-testid="app-shell-date" className="font-mono text-xs uppercase tracking-[0.2em]" aria-label="Today's date">{formatToday()}</span>
          <LogoutButton />
          <HexStamp />
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-48px)]">
        <Sidebar currentRole={currentRole} activePath={location.pathname} onNavigate={navigate} />
        <main data-testid="app-shell-main" className="min-w-0 flex-1 px-6 py-8">{children ?? <Outlet />}</main>
      </div>
      <ToastHost />
    </div>
  );
}
