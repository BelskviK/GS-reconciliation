import type {
  ContractStatus,
  MatchMethod,
  TransactionStatus,
} from "@/types/database";

/**
 * Domain types used throughout the app (services, hooks, components).
 *
 * These differ from the raw `Database["public"]["Tables"][...]["Row"]`
 * types in one important way: numeric Postgres columns (amount,
 * monthly_amount, match_confidence) arrive over PostgREST as strings to
 * avoid float precision loss. We parse them to `number` once, at the
 * service boundary, so every component downstream works with real numbers
 * and never has to remember to parseFloat() a money field.
 */

export interface Company {
  id: string;
  name: string;
  taxId: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  companyId: string;
  monthlyAmount: number;
  status: ContractStatus;
  startDate: string; // "YYYY-MM-DD"
  endDate: string | null;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  docKey: string;
  entryDate: string; // "YYYY-MM-DD"
  amount: number;
  currency: string;
  senderName: string | null;
  senderInn: string | null;
  senderAccount: string | null;
  purpose: string | null;
  matchedCompanyId: string | null;
  matchMethod: MatchMethod | null;
  matchConfidence: number | null;
  status: TransactionStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated via join when fetching with company info
  matchedCompanyName?: string | null;
}

export { type ContractStatus, type MatchMethod, type TransactionStatus };
