import { useQuery } from "@tanstack/react-query";
import { getAccounts } from "@/modules/ledger/services/account.service";
import { queryKeys } from "@/lib/query/queryKeys";

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.ledger.accounts,
    queryFn: getAccounts,
    // Chart of accounts is seeded, read-only for this branch — changes
    // only via a new migration, so there's nothing to invalidate against.
    staleTime: 5 * 60 * 1000,
  });
}
