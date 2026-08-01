import type { MouseEvent } from 'react';
import { HexStamp } from '@/atoms/HexStamp';

export interface SidebarProps {
  currentRole: 'admin' | 'user' | null;
  activePath: string;
  onNavigate?: (path: string) => void;
}

const links: readonly { label: string; path: string; roles: readonly ('admin' | 'user')[] }[] = [
  { label: 'Tablero', path: '/dashboard', roles: ['admin', 'user'] },
  { label: 'Transacciones', path: '/transactions', roles: ['admin', 'user'] },
  { label: 'Cuentas', path: '/accounts', roles: ['admin', 'user'] },
  { label: 'Insights', path: '/insights', roles: ['admin', 'user'] },
  { label: 'Categorías', path: '/admin/categories', roles: ['admin'] },
  { label: 'Usuarios', path: '/admin/users', roles: ['admin'] },
] as const;

export function Sidebar({ currentRole, activePath, onNavigate }: SidebarProps) {
  const visibleLinks = links.filter((link) => currentRole && link.roles.includes(currentRole));

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <nav aria-label="Navegación principal" data-testid="app-shell-sidebar" className="hidden w-60 shrink-0 border-r border-ink-paper-press bg-ink-paper-lift md:block">
      <div className="flex items-center gap-2 px-5 py-6">
        <HexStamp />
        <span className="font-display text-sm font-bold lowercase tracking-[0.18em]">FINANZAS</span>
      </div>
      <ul className="space-y-1 px-3">
        {visibleLinks.map((link) => {
          const isActive = activePath === link.path;
          return (
            <li key={link.path}>
              <a
                href={link.path}
                onClick={(event) => handleClick(event, link.path)}
                aria-current={isActive ? 'page' : undefined}
                className={`block border-l-4 px-3 py-2 font-body text-sm transition-colors ${isActive ? 'border-ink-cobalto bg-ink-cobalto/10 text-ink-cobalto' : 'border-transparent text-ink-tinta hover:border-ink-cobalto hover:text-ink-cobalto'}`}
              >
                {link.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
