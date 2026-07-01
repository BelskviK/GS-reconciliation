import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getTransactions } from "@/services/transaction.service";
import type { TransactionFilters } from "@/services/transaction.service";
import { queryKeys } from "@/lib/query/queryKeys";

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () => getTransactions(filters),
    // Each distinct filter combination (month/status/search) is its own
    // cache entry, so re-visiting one you've already fetched this session
    // (switching month tabs back and forth, toggling a status filter off
    // and back on) should be served from cache with NO network call.
    //
    // That requires overriding the 30s staleTime set globally in
    // QueryProvider: with the default, cached data still renders
    // instantly, but once 30s have passed react-query treats it as stale
    // and fires a background refetch on remount anyway, which is exactly
    // the "still see it in the network tab" behavior this was meant to
    // avoid. Setting staleTime: Infinity here means this data is never
    // considered stale by the clock; the only thing that invalidates it
    // is the explicit invalidateQueries(queryKeys.transactions.all) call
    // every mutation in useTransactionMutations.ts already makes. That's
    // the correct model for this data: it doesn't change on its own
    // (no polling backend), it only changes when a mutation we control
    // says so.
    staleTime: Infinity,
    // placeholderData: keepPreviousData keeps the last-rendered rows on
    // screen while a genuinely new (never-before-fetched) filter
    // combination is in flight, so the table doesn't flash to a loading
    // skeleton on every keystroke/filter change; it just updates in
    // place once the new data arrives.
    placeholderData: keepPreviousData,
  });
}
