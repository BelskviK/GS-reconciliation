import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { AccountBalance } from "@/modules/ledger/types";

type AccountBalanceRow = Database["public"]["Views"]["account_balances"]["Row"];

function toAccountBalance(row: AccountBalanceRow): AccountBalance {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    normalBalance: row.normal_balance,
    isActive: row.is_active,
    balance: parseFloat(row.balance),
  };
}

/**
 * Reads the account_balances view (see schema.sql) — one row per
 * account with its running balance already signed for that account's
 * normal_balance. Read-only, same as the rest of this module.
 */
export async function getAccountBalances(): Promise<AccountBalance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(`Failed to load account balances: ${error.message}`);
  }

  return (data ?? []).map(toAccountBalance);
}
