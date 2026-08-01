/**
 * useUsers — TanStack Query bindings for Users (admin-only path).
 *
 * Endpoints:
 *  - GET /users
 *  - POST /users
 *
 * The router guard restricts mounting to admin actors (REQ-FFC-USR-LIST-ADMIN).
 * Non-admins never reach this hook.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import type { User, UserTier } from '@/services/types';
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
  tier: UserTier;
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