import { useQuery } from "@tanstack/react-query";
import { getCompanies } from "@/services/company.service";
import { queryKeys } from "@/lib/query/queryKeys";

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: getCompanies,
    staleTime: 5 * 60 * 1000, // companies change rarely
  });
}
