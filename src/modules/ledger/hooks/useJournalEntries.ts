import { useQuery } from "@tanstack/react-query";
import { getJournalEntries } from "@/modules/ledger/services/journalEntry.service";
import { queryKeys } from "@/lib/query/queryKeys";

export function useJournalEntries() {
  return useQuery({
    queryKey: queryKeys.ledger.journalEntries,
    queryFn: getJournalEntries,
    // Invalidated by useRunAutoMatching/useManuallyMatchTransaction/
    // useUnmatchTransaction in useTransactionMutations.ts — every one of
    // those can flip bank_transactions.status through 'matched', which is
    // exactly what the DB trigger in 005/006 reacts to. staleTime here is
    // just a ceiling for the case nothing invalidated it.
    staleTime: 5 * 60 * 1000,
  });
}
