/**
 * useUsers — TanStack Query bindings for Users (admin-only path).
 *
 * Endpoints:
 *  - GET /users
 *  - POST /users
 *  - DELETE /users/:id  (admin-only, no self-delete)
 *
 * The router guard restricts mounting to admin actors (REQ-FFC-USR-LIST-ADMIN).
 * Non-admins never reach this hook.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import type { User } from '@/services/types';
import { joinUrl } from '@/services/url';

const KEY = ['users'] as const;

export interface UseUsersArgs {
  apiBaseUrl: string;
}

export function usersQueryKey() {
  return [...KEY];
}

export function useUsers({ apiBaseUrl }: UseUsersArgs) {
  return useQuery({
    queryKey: [...KEY],
    queryFn: async () => {
      const res = await apiClient.get<User[]>(joinUrl(apiBaseUrl, 'users'));
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: 'admin' | 'user';
  tempPassword: string;
}

export function useCreateUser({ apiBaseUrl }: UseUsersArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const res = await apiClient.post<User>(joinUrl(apiBaseUrl, 'users'), input);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteUser({ apiBaseUrl }: UseUsersArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.del<void>(joinUrl(apiBaseUrl, `users/${id}`));
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    // Optimistic delete — drop the row immediately, restore on error.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<User[]>(KEY);
      if (previous) {
        qc.setQueryData<User[]>(
          KEY,
          previous.filter((u) => u.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      const ctx = context as { previous?: User[] } | undefined;
      if (ctx?.previous) {
        qc.setQueryData<User[]>(KEY, ctx.previous);
      }
      qc.invalidateQueries({ queryKey: KEY });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}