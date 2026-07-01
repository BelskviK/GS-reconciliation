import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Contract } from "@/types/domain";

type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];

function toContract(row: ContractRow): Contract {
  return {
    id: row.id,
    companyId: row.company_id,
    monthlyAmount: parseFloat(row.monthly_amount),
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  };
}

export async function getContracts(): Promise<Contract[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(`Failed to load contracts: ${error.message}`);
  }

  return (data ?? []).map(toContract);
}

/**
 * Returns true if a contract was "active" at any point during the given
 * month, for the purpose of computing expected payment.
 *
 * Rule (this is the part the assignment explicitly calls out, so it's
 * worth being explicit and testable rather than clever):
 *
 *   - The contract must have started on or before the LAST day of the month
 *     (start_date <= monthEnd)
 *   - AND it must not have ended/paused before the FIRST day of the month
 *     (end_date IS NULL OR end_date >= monthStart)
 *
 * This intentionally treats 'paused' and 'ended' the same way for the
 * purposes of this calculation: both carry an end_date that marks the
 * point after which the company stopped being expected to pay. A contract
 * that paused ON the 15th of a month is still "active during" that month
 * (the company owed a partial month), which is exactly the April /
 * Safe Transport scenario in the seed data: paused 2026-05-15 still
 * counts as active for May, but not for June.
 *
 * Contracts still 'active' with status === 'active' and no end_date are
 * always counted, since the assignment data doesn't include a future
 * end_date for currently-active contracts.
 */
export function isContractActiveInMonth(
  contract: Contract,
  monthStart: string, // "YYYY-MM-DD", first day of month
  monthEnd: string, // "YYYY-MM-DD", last day of month
): boolean {
  const startedInTimeOrBefore = contract.startDate <= monthEnd;
  const notEndedBeforeMonth =
    contract.endDate === null || contract.endDate >= monthStart;

  return startedInTimeOrBefore && notEndedBeforeMonth;
}

/**
 * Sums monthlyAmount across all contracts for a company that were active
 * during the given month. A company can have multiple concurrent active
 * contracts (e.g. ეკო ტრანსპორტი has two), so this is a sum, not a
 * single lookup.
 */
export function getExpectedAmountForCompanyInMonth(
  contracts: Contract[],
  companyId: string,
  monthStart: string,
  monthEnd: string,
): number {
  return contracts
    .filter((c) => c.companyId === companyId)
    .filter((c) => isContractActiveInMonth(c, monthStart, monthEnd))
    .reduce((sum, c) => sum + c.monthlyAmount, 0);
}
