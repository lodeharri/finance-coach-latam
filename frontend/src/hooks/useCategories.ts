/**
 * useCategories — TanStack Query bindings for the Categories admin.
 *
 * Endpoints:
 *  - GET /categories
 *  - POST /categories
 *  - PATCH /categories/:id
 *  - DELETE /categories/:id  (409 on category-in-use, optimistic + restore)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import type { Category } from '@/services/types';

const KEY = ['categories'] as const;

export interface UseCategoriesArgs {
  apiBaseUrl: string;
}

export function categoriesQueryKey() {
  return [...KEY];
}

export function useCategories({ apiBaseUrl }: UseCategoriesArgs) {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await apiClient.get<Category[]>(`${apiBaseUrl}/categories`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });
}

export function useCreateCategory({ apiBaseUrl }: UseCategoriesArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slug: string; name: string; color: string }) => {
      const res = await apiClient.post<Category>(`${apiBaseUrl}/categories`, input);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory({ apiBaseUrl }: UseCategoriesArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; color?: string } }) => {
      const res = await apiClient.patch<Category>(`${apiBaseUrl}/categories/${id}`, patch);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory({ apiBaseUrl }: UseCategoriesArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.del<void>(`${apiBaseUrl}/categories/${id}`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    // Optimistic delete — drop the row immediately, restore on 409.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Category[]>(KEY);
      if (previous) {
        qc.setQueryData<Category[]>(
          KEY,
          previous.filter((c) => c.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      const ctx = context as { previous?: Category[] } | undefined;
      if (ctx?.previous) {
        qc.setQueryData<Category[]>(KEY, ctx.previous);
      }
      qc.invalidateQueries({ queryKey: KEY });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}