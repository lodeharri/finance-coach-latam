/**
 * useTransactions — TanStack Query bindings for Transactions.
 *
 * Endpoints:
 *  - GET /transactions
 *  - POST /transactions
 *  - PATCH /transactions/:id
 *  - POST /transactions/:id/categorize
 *
 * All URL construction goes through joinUrl to fix the CORS double-slash
 * bug (REQ-FFC-FE-CORS-FIX).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import type { Transaction } from '@/services/types';
import { joinUrl } from '@/services/url';

const KEY = ['transactions'] as const;

export interface UseTransactionsArgs {
  apiBaseUrl: string;
  userId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export function transactionsQueryKey() {
  return [...KEY];
}

function buildQuery(limit?: number, userId?: string, offset?: number): string {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  if (userId !== undefined) params.set('userId', userId);
  if (offset !== undefined) params.set('offset', String(offset));
  const qs = params.toString();
  return qs ? `transactions?${qs}` : 'transactions';
}

export function useTransactions({ apiBaseUrl, userId, limit, offset }: UseTransactionsArgs) {
  return useQuery({
    queryKey: [...KEY, userId ?? null, limit ?? null, offset ?? null] as const,
    queryFn: async () => {
      const res = await apiClient.get<Transaction[]>(joinUrl(apiBaseUrl, buildQuery(limit, userId, offset)));
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });
}

export interface CreateTransactionInput {
  userId: string;
  accountId: string;
  merchant: string;
  amountCents: number;
  occurredAt: string;
  notes?: string | null;
  categoryId?: string | null;
}

export function useCreateTransaction({ apiBaseUrl }: UseTransactionsArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const res = await apiClient.post<Transaction>(joinUrl(apiBaseUrl, 'transactions'), input);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface UpdateTransactionInput {
  transactionId: string;
  categoryId: string;
}

export function useUpdateTransaction({ apiBaseUrl }: UseTransactionsArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionId, categoryId }: UpdateTransactionInput) => {
      const res = await apiClient.patch<Transaction>(
        joinUrl(apiBaseUrl, `transactions/${transactionId}`),
        { categoryId },
      );
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export interface RecategorizeTransactionInput {
  transactionId: string;
}

export function useRecategorizeTransaction({ apiBaseUrl }: UseTransactionsArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionId }: RecategorizeTransactionInput) => {
      const res = await apiClient.post<Transaction>(
        joinUrl(apiBaseUrl, `transactions/${transactionId}/categorize`),
        {},
      );
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}