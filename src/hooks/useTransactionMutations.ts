import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  runAutoMatching,
  manuallyMatchTransaction,
  updateTransactionStatus,
  updateTransactionComment,
  unmatchTransaction,
} from "@/services/transaction.service";
import { queryKeys } from "@/lib/query/queryKeys";
import type { TransactionStatus } from "@/types/domain";

/**
 * Invalidation strategy: every mutation here can change which bucket a
 * transaction falls into (unmatched -> matched, or matched -> ignored),
 * which means it can change every filtered view of the transactions list
 * (the "all" view, the "matched only" view, etc. all read from the same
 * underlying rows). Rather than trying to surgically patch each cached
 * filter combination, we invalidate the whole `transactions` key space —
 * `queryKeys.transactions.all` is a prefix of every `list(filters)` key,
 * so TanStack Query's partial matching invalidates all of them in one
 * call. This is the right tradeoff here: the transaction list is small
 * (a few dozen to ~100 rows for a given month) so a full refetch is cheap,
 * and correctness (always showing the true post-mutation state) matters
 * more than shaving a network request on a dataset this size.
 */

export function useRunAutoMatching() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runAutoMatching,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useManuallyMatchTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      companyId,
      confidence,
    }: {
      transactionId: string;
      companyId: string;
      confidence?: number;
    }) => manuallyMatchTransaction(transactionId, companyId, confidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useUpdateTransactionComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      comment,
    }: {
      transactionId: string;
      comment: string;
    }) => updateTransactionComment(transactionId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useUpdateTransactionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      status,
    }: {
      transactionId: string;
      status: TransactionStatus;
    }) => updateTransactionStatus(transactionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

export function useUnmatchTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) => unmatchTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
