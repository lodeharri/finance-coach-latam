/**
 * useAccounts — TanStack Query bindings for Accounts.
 *
 * Endpoints:
 *  - GET /accounts?userId=<id>
 *  - POST /accounts
 *
 * All URL construction via joinUrl (REQ-FFC-FE-CORS-FIX).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import type { Account, AccountType } from '@/services/types';
import { joinUrl } from '@/services/url';

const KEY = ['accounts'] as const;

export interface UseAccountsArgs {
  apiBaseUrl: string;
  userId?: string | undefined;
}

export function accountsQueryKey() {
  return [...KEY];
}

export function useAccounts({ apiBaseUrl, userId }: UseAccountsArgs) {
  return useQuery({
    queryKey: [...KEY, userId ?? null] as const,
    queryFn: async () => {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const res = await apiClient.get<Account[]>(joinUrl(apiBaseUrl, `accounts${qs}`));
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });
}

export interface CreateAccountInput {
  userId: string;
  name: string;
  type: AccountType;
}

export function useCreateAccount({ apiBaseUrl }: UseAccountsArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      const res = await apiClient.post<Account>(joinUrl(apiBaseUrl, 'accounts'), input);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}