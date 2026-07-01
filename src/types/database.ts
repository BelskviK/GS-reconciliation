/**
 * Hand-authored to mirror seed_schema.sql exactly.
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
          comment: string | null; // optional column, see migration 003
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
    };
    Views: Record<string, never>;
    Functions: {
      match_transactions_by_inn: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}
