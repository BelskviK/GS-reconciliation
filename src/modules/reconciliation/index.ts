// Public surface of the "reconciliation" domain module.
//
// This does NOT physically move the existing, working files under
// src/components/dashboard, src/hooks, and src/services — it re-exports
// them. See docs/ARCHITECTURE.md section 3.1 for why: this branch's job
// is to add module boundaries without risking the one feature that
// already works end-to-end. New code (this branch's `ledger` module,
// and any future domain) should import reconciliation pieces from here
// rather than reaching into src/components/dashboard directly, so that a
// later physical move to src/modules/reconciliation/** is a file move
// plus an import-path update in this one file — not a hunt through every
// consumer in the codebase.

// Data hooks
export { useTransactions } from "@/hooks/useTransactions";
export { useCompanies } from "@/hooks/useCompanies";
export { useContracts } from "@/hooks/useContracts";
export {
  useRunAutoMatching,
  useManuallyMatchTransaction,
  useUnmatchTransaction,
  useUpdateTransactionStatus,
  useUpdateTransactionComment,
} from "@/hooks/useTransactionMutations";

// Service layer (for server components / non-hook callers)
export {
  getTransactions,
  runAutoMatching,
  manuallyMatchTransaction,
  unmatchTransaction,
  updateTransactionStatus,
  updateTransactionComment,
  hasCommentColumn,
  MatchingFunctionMissingError,
  type TransactionFilters,
} from "@/services/transaction.service";
export { getCompanies } from "@/services/company.service";
export {
  getContracts,
  getExpectedAmountForCompanyInMonth,
} from "@/services/contract.service";

// Dashboard components
export { StatsBar } from "@/components/dashboard/StatsBar";
export { MonthTabs } from "@/components/dashboard/MonthTabs";
export { FilterBar } from "@/components/dashboard/FilterBar";
export { TransactionsTable } from "@/components/dashboard/TransactionsTable";
export { ExpectedVsActual } from "@/components/dashboard/ExpectedVsActual";
export { RunMatchingButton } from "@/components/dashboard/RunMatchingButton";

// Domain types
export type {
  BankTransaction,
  Company,
  Contract,
  TransactionStatus,
  MatchMethod,
  ContractStatus,
} from "@/types/domain";
