import type { TransactionFilters } from "@/services/transaction.service";

/**
 * Centralized query key factory.
 *
 * Keeping these in one place (rather than inlining ['transactions', month]
 * arrays at each call site) is what makes invalidation reliable: a typo
 * in a manually-typed key silently creates a cache miss that "works" but
 * never invalidates. Hierarchical keys also let us invalidate broadly
 * (all transactions) or narrowly (one filtered view) on purpose.
 */
export const queryKeys = {
  companies: {
    all: ["companies"] as const,
  },
  contracts: {
    all: ["contracts"] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (filters: TransactionFilters) =>
      ["transactions", "list", filters] as const,
  },
};
