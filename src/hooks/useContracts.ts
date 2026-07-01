import { useQuery } from "@tanstack/react-query";
import { getContracts } from "@/services/contract.service";
import { queryKeys } from "@/lib/query/queryKeys";

export function useContracts() {
  return useQuery({
    queryKey: queryKeys.contracts.all,
    queryFn: getContracts,
    staleTime: 5 * 60 * 1000, // contracts change rarely
  });
}
