/**
 * AuthShell template — Litografía del Sur.
 *
 * Centered paper card on the warm-paper background. Hosts authentication forms
 * (LoginPage). Templates receive content; they own no API calls.
 */
import type { ReactNode } from 'react';

export interface AuthShellProps {
  title?: string;
  children: ReactNode;
}

export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-ink-paper px-4 py-12"
      data-testid="auth-shell"
    >
      <div
        data-testid="auth-shell-card"
        className="w-full max-w-md rounded border border-ink-paper-press bg-ink-paper-lift p-8 shadow-sm"
      >
        {title ? (
          <h2 className="mb-6 font-display text-xl font-bold text-ink-tinta">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}