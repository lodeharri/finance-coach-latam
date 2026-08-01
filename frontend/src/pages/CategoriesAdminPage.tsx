/**
 * CategoriesAdminPage — Litografía del Sur.
 *
 * Admin-only page that wraps the CategoryTable organism inside AppShell.
 * Admin role gating is enforced by RequireRole in the router.
 */
import { useAuth } from '@/hooks/useAuth';
import { CategoryTable } from '@/organisms/CategoryTable';
import { AppShell } from '@/templates/AppShell';

export interface CategoriesAdminPageProps {
  apiBaseUrl: string;
}

export function CategoriesAdminPage({ apiBaseUrl }: CategoriesAdminPageProps) {
  const auth = useAuth();
  return (
    <AppShell pageName="Categories (Admin)" {...(auth.role ? { role: auth.role } : {})}>
      <CategoryTable apiBaseUrl={apiBaseUrl} />
    </AppShell>
  );
}