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
 *
 * Ledger invalidation (recommendation branch, see docs/ARCHITECTURE.md):
 * runAutoMatching, manuallyMatchTransaction, and unmatchTransaction all
 * flip bank_transactions.status through 'matched', which is exactly what
 * the DB trigger in schema.sql reacts to by posting or
 * removing a journal entry. The app code doesn't call the ledger
 * directly (that's the point of the trigger being an "adapter"), but the
 * *cache* still needs to know journalEntries/accountBalances went stale —
 * otherwise a user who matches from /reconciliation and then opens the
 * ledger (the app's root, /) would see up-to-5-minutes-stale numbers. If
 * the ledger section of schema.sql was never run, these two keys simply
 * have no active queries and invalidating them is a no-op.
 */
const LEDGER_KEYS_AFFECTED_BY_MATCHING = [
  queryKeys.ledger.journalEntries,
  queryKeys.ledger.accountBalances,
];

function invalidateAfterMatchChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  for (const key of LEDGER_KEYS_AFFECTED_BY_MATCHING) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

export function useRunAutoMatching() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runAutoMatching,
    onSuccess: () => {
      invalidateAfterMatchChange(queryClient);
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
      invalidateAfterMatchChange(queryClient);
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
      // Unmatching also flips status away from 'matched', which is what
      // makes the trigger remove that transaction's journal entry — see
      // invalidateAfterMatchChange() above.
      invalidateAfterMatchChange(queryClient);
    },
  });
}
