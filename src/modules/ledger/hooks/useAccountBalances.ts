import { useQuery } from "@tanstack/react-query";
import { getAccountBalances } from "@/modules/ledger/services/accountBalance.service";
import { queryKeys } from "@/lib/query/queryKeys";

export function useAccountBalances() {
  return useQuery({
    queryKey: queryKeys.ledger.accountBalances,
    queryFn: getAccountBalances,
    // Same invalidation story as useJournalEntries — see that file.
    staleTime: 5 * 60 * 1000,
  });
}
