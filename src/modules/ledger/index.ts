// Public surface of the ledger module. Anything outside this folder
// (pages, other modules) should import from here rather than reaching
// into src/modules/ledger/{services,hooks,components} directly — see
// docs/ARCHITECTURE.md section 3 for why that boundary matters.

export * from "@/modules/ledger/types";
export { useAccounts } from "@/modules/ledger/hooks/useAccounts";
export { useJournalEntries } from "@/modules/ledger/hooks/useJournalEntries";
export { useAccountBalances } from "@/modules/ledger/hooks/useAccountBalances";
export { ChartOfAccountsTable } from "@/modules/ledger/components/ChartOfAccountsTable";
export { JournalEntriesTable } from "@/modules/ledger/components/JournalEntriesTable";
export { BalanceSheetPanel } from "@/modules/ledger/components/BalanceSheetPanel";
export { ProfitAndLossPanel } from "@/modules/ledger/components/ProfitAndLossPanel";
export { LedgerNav } from "@/modules/ledger/components/LedgerNav";
export { LedgerMatchButton } from "@/modules/ledger/components/LedgerMatchButton";
export { LedgerSidebar } from "@/modules/ledger/components/LedgerSidebar";
export {
  MatchHighlightProvider,
  useMatchHighlight,
} from "@/modules/ledger/context/MatchHighlightContext";
export { computeAccountBalances } from "@/modules/ledger/utils/computeAccountBalances";
