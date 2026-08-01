import type { MouseEvent } from 'react';
import { HexStamp } from '@/atoms/HexStamp';

export interface SidebarProps {
  currentRole: 'admin' | 'user' | null;
  activePath: string;
  onNavigate?: (path: string) => void;
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

export function Sidebar({ currentRole, activePath, onNavigate }: SidebarProps) {
  const visibleLinks = links.filter((link) => currentRole && link.roles.includes(currentRole));

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(path);
    }
  };

  return (
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
    </nav>
  );
}
