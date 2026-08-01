/**
 * AppShell template — Litografía del Sur.
 *
 * The signature chrome of every authenticated page (design §1.5):
 *  - 48px cobalt masthead with page name (Bricolage Grotesque), today's date
 *    (JetBrains Mono, right-aligned), and the HexStamp SVG.
 *  - Paper canvas with children content area.
 *
 * Templates receive content; they own no API calls (REQ-FF-ATOMS-BOUNDARY).
 */
import type { ReactNode } from 'react';
import { HexStamp } from '@/atoms/HexStamp';
import { RoleBadge } from '@/molecules/RoleBadge';
import { ToastHost } from '@/organisms/ToastHost';

export interface AppShellProps {
  pageName: string;
  role?: 'admin' | 'user';
  children: ReactNode;
}

function formatToday(): string {
  // Compact ledger style: "01 ENE 2026". Locale-independent upper-case day+month.
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = months[now.getMonth()] ?? '';
  return `${dd} ${mm} ${now.getFullYear()}`;
}

export function AppShell({ pageName, role, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-ink-paper text-ink-tinta font-body">
      <header
        data-testid="app-shell-masthead"
        className="flex items-center justify-between bg-ink-cobalto px-6 text-ink-paper"
        style={{ height: '48px' }}
      >
        <h1
          className="font-display text-lg font-bold tracking-wide"
          data-testid="app-shell-page-name"
        >
          {pageName}
        </h1>
        <div className="flex items-center gap-3">
          {role ? <RoleBadge role={role} /> : null}
          <span
            data-testid="app-shell-date"
            className="font-mono text-xs uppercase tracking-[0.2em]"
            aria-label="Today's date"
          >
            {formatToday()}
          </span>
          <HexStamp />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <ToastHost />
    </div>
  );
}