/**
 * useTransactions — TanStack Query bindings for Transactions.
 *
 * Endpoints:
 *  - GET /transactions
 *  - GET /transactions/:id
 *  - POST /transactions
 *  - PATCH /transactions/:id
 *  - POST /transactions/:id/categorize
 *
 * All URL construction goes through joinUrl to fix the CORS double-slash
 * bug (REQ-FFC-FE-CORS-FIX).
 */
import { useEffect, useRef, useState } from 'react';
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

/**
 * Polls a single transaction until the categorizer worker writes a
 * terminal status (CATEGORIZED or FAILED). Stops polling on FAILED so the
 * user can manually retry via the Recategorize button instead of hammering
 * a row the worker has given up on.
 *
 * Exposes:
 *  - data: the latest polled Transaction, or undefined while loading.
 *  - isTimeout: true after 90s of PENDING without resolution.
 *  - error: any fetch error (404, network, validation). Null otherwise.
 *  - refetch: manual retry trigger.
 */
export interface UseCategorizationStatusResult {
  data: Transaction | null | undefined;
  isTimeout: boolean;
  error: Error | null;
  refetch: () => void;
}

const POLL_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 3_000;

function readApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      '[useCategorizationStatus] Missing VITE_API_BASE_URL env var.',
    );
  }
  return value;
}

export function useCategorizationStatus(
  transactionId: string | null,
): UseCategorizationStatusResult {
  const [isTimeout, setIsTimeout] = useState(false);
  const apiBaseUrl = readApiBaseUrl();
  // Wall-clock instant when the current row first entered PENDING. Survives
  // polling re-renders so the 90s window measures continuous PENDING time,
  // not "any 90s while polling was active".
  const pendingSinceRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: ['transaction-status', transactionId] as const,
    queryFn: async () => {
      if (!transactionId) return null;
      const res = await apiClient.get<Transaction>(
        joinUrl(apiBaseUrl, `transactions/${transactionId}`),
      );
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    enabled: !!transactionId,
    // Only poll while PENDING. FAILED stops polling so the user can click
    // Recategorize manually; CATEGORIZED is terminal.
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? POLL_INTERVAL_MS : false),
    staleTime: 0,
  });

  // Reset the timeout flag whenever the tracked transaction changes
  // (or polling restarts after the previous one resolved).
  useEffect(() => {
    pendingSinceRef.current = null;
    setIsTimeout(false);
  }, [transactionId]);

  // Arm a 90s timer while the row is PENDING. Re-arms on every refetch but
  // computes `remaining` from the FIRST PENDING observation so the timeout
  // measures 90s of continuous PENDING — not 90s since the latest poll.
  useEffect(() => {
    if (!transactionId || query.data?.status !== 'PENDING') return;
    if (pendingSinceRef.current === null) {
      pendingSinceRef.current = Date.now();
    }
    const elapsed = Date.now() - pendingSinceRef.current;
    const remaining = Math.max(0, POLL_TIMEOUT_MS - elapsed);
    const timer = setTimeout(() => setIsTimeout(true), remaining);
    return () => clearTimeout(timer);
  }, [transactionId, query.data?.status, query.dataUpdatedAt]);

  return {
    data: query.data,
    isTimeout,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}