import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Account } from "@/modules/ledger/types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    normalBalance: row.normal_balance,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * Read-only for this branch — see docs/ARCHITECTURE.md section 5
 * (explicit non-goals). The chart of accounts is seeded by schema.sql;
 * there is no create/edit UI yet, so this module only ever reads.
 */
export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(`Failed to load accounts: ${error.message}`);
  }

  return (data ?? []).map(toAccount);
}
