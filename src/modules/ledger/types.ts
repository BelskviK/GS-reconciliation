import type {
  AccountType,
  NormalBalance,
  FinancialEventDirection,
  FinancialEventSourceType,
} from "@/types/database";

// Re-exported so components can import these alongside the ledger-specific
// types below (Account, AccountBalance, ...) from one module path, instead
// of reaching into "@/types/database" separately for just the enums.
export type { AccountType, NormalBalance };

/**
 * Domain types for the ledger module, following the same convention as
 * src/types/domain.ts: raw NUMERIC columns arrive over PostgREST as
 * strings and are parsed to `number` once at the service boundary, so
 * every component downstream works with real numbers.
 */

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  createdAt: string;
}

export interface FinancialEvent {
  id: string;
  sourceType: FinancialEventSourceType;
  sourceId: string;
  occurredAt: string; // "YYYY-MM-DD"
  amount: number;
  direction: FinancialEventDirection;
  description: string | null;
  createdAt: string;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  // Populated via join when fetching with account info
  accountCode?: string;
  accountName?: string;
}

export interface JournalEntry {
  id: string;
  financialEventId: string | null;
  entryDate: string; // "YYYY-MM-DD"
  description: string | null;
  createdAt: string;
  lines: JournalLine[];
}

/**
 * One row per account, from the account_balances view — the running
 * balance already signed according to that account's normal_balance, so
 * an asset/expense account with more debits than credits and a
 * liability/equity/revenue account with more credits than debits both
 * come back as a positive number ready to display as-is.
 */
export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  balance: number;
}
