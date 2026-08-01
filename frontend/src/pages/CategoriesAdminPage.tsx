/**
 * CategoriesAdminPage — Litografía del Sur.
 *
 * Admin-only page that renders the CategoryTable organism.
 * Admin role gating is enforced by RequireRole in the router.
 */
import { CategoryTable } from '@/organisms/CategoryTable';

export interface CategoriesAdminPageProps {
  apiBaseUrl: string;
}

export function CategoriesAdminPage({ apiBaseUrl }: CategoriesAdminPageProps) {
  return <CategoryTable apiBaseUrl={apiBaseUrl} />;
}