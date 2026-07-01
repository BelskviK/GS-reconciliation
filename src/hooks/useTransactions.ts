import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "@/services/transaction.service";
import type { TransactionFilters } from "@/services/transaction.service";
import { queryKeys } from "@/lib/query/queryKeys";

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () => getTransactions(filters),
  });
}
