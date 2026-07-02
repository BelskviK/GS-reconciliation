/**
 * Hand-authored to mirror schema.sql exactly.
 *
 * In a longer-lived project this file would be generated with:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 * which keeps it in sync with the live schema automatically. For this
 * project the schema is fixed by the assignment brief, so a hand-written
 * version avoids needing CLI access to the Supabase project, while still
 * matching the generated shape (Row / Insert / Update per table).
 */

export type ContractStatus = "active" | "paused" | "ended";
export type TransactionStatus = "matched" | "unmatched" | "ignored";
export type MatchMethod = "inn_exact" | "manual";

// --- Ledger foundation (recommendation branch, see docs/ARCHITECTURE.md) ---
// Additive only — these types describe the ledger section of schema.sql.
export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";
export type NormalBalance = "debit" | "credit";
export type FinancialEventDirection = "inflow" | "outflow";
export type FinancialEventSourceType =
  | "contract" // stage 1: contract created, demand posted (Dr 1410 / Cr 6000)
  | "bank_transaction_import" // stage 2: transaction imported, full amount into 1490
  | "bank_transaction_match" // stage 3: transaction matched, reclassified into 1210
  | "invoice" // future: a real invoicing module, distinct from "contract" above
  | "expense"
  | "payroll"
  | "manual";

export interface Database {
  // Required by @supabase/supabase-js 2.108+ to correctly resolve the
  // PostgREST client's generic ClientOptions/SchemaName parameters.
  // Without this, .update()/.insert() argument types can silently widen
  // to `never` on some TS versions. See supabase-js PostgrestClient.ts.
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          tax_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tax_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tax_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          company_id: string;
          monthly_amount: string; // numeric comes back as string from postgrest
          status: ContractStatus;
          start_date: string; // date as ISO "YYYY-MM-DD"
          end_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          monthly_amount: number;
          status: ContractStatus;
          start_date: string;
          end_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          monthly_amount?: number;
          status?: ContractStatus;
          start_date?: string;
          end_date?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      bank_transactions: {
        Row: {
          id: string;
          doc_key: string;
          entry_date: string;
          amount: string; // numeric comes back as string from postgrest
          currency: string;
          sender_name: string | null;
          sender_inn: string | null;
          sender_account: string | null;
          purpose: string | null;
          matched_company_id: string | null;
          match_method: MatchMethod | null;
          match_confidence: string | null;
          status: TransactionStatus;
          comment: string | null; // standard column since schema.sql
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doc_key: string;
          entry_date: string;
          amount: number;
          currency?: string;
          sender_name?: string | null;
          sender_inn?: string | null;
          sender_account?: string | null;
          purpose?: string | null;
          matched_company_id?: string | null;
          match_method?: MatchMethod | null;
          match_confidence?: number | null;
          status?: TransactionStatus;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          doc_key?: string;
          entry_date?: string;
          amount?: number;
          currency?: string;
          sender_name?: string | null;
          sender_inn?: string | null;
          sender_account?: string | null;
          purpose?: string | null;
          matched_company_id?: string | null;
          match_method?: MatchMethod | null;
          match_confidence?: number | null;
          status?: TransactionStatus;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bank_transactions_matched_company_id_fkey";
            columns: ["matched_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      // --- Ledger foundation tables (see schema.sql) ---
      financial_events: {
        Row: {
          id: string;
          source_type: FinancialEventSourceType;
          source_id: string;
          occurred_at: string;
          amount: string; // numeric comes back as string from postgrest
          direction: FinancialEventDirection;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_type: FinancialEventSourceType;
          source_id: string;
          occurred_at: string;
          amount: number;
          direction: FinancialEventDirection;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_type?: FinancialEventSourceType;
          source_id?: string;
          occurred_at?: string;
          amount?: number;
          direction?: FinancialEventDirection;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          code: string;
          name: string;
          type: AccountType;
          normal_balance: NormalBalance;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          type: AccountType;
          normal_balance: NormalBalance;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          type?: AccountType;
          normal_balance?: NormalBalance;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          financial_event_id: string | null;
          entry_date: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          financial_event_id?: string | null;
          entry_date: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          financial_event_id?: string | null;
          entry_date?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_financial_event_id_fkey";
            columns: ["financial_event_id"];
            isOneToOne: false;
            referencedRelation: "financial_events";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          account_id: string;
          debit: string; // numeric comes back as string from postgrest
          credit: string;
        };
        Insert: {
          id?: string;
          journal_entry_id: string;
          account_id: string;
          debit?: number;
          credit?: number;
        };
        Update: {
          id?: string;
          journal_entry_id?: string;
          account_id?: string;
          debit?: number;
          credit?: number;
        };
        Relationships: [
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey";
            columns: ["journal_entry_id"];
            isOneToOne: false;
            referencedRelation: "journal_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      // See schema.sql
      account_balances: {
        Row: {
          id: string;
          code: string;
          name: string;
          type: AccountType;
          normal_balance: NormalBalance;
          is_active: boolean;
          balance: string; // numeric comes back as string from postgrest
        };
      };
    };
    Functions: {
      match_transactions_by_inn: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}
