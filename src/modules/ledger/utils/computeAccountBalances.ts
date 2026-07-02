import type { Account, AccountBalance, JournalEntry } from "@/modules/ledger/types";
import type { MonthRange } from "@/lib/utils/month";

/**
 * Client-side mirror of the account_balances view (schema.sql): same signed-balance
 * formula (debit-normal accounts show sum(debit) - sum(credit), credit-normal
 * accounts show the reverse), just computed over an in-memory JournalEntry[]
 * instead of a live SQL aggregate.
 *
 * Why this exists instead of adding a date param to the SQL view: the view
 * answers "all-time balance" cheaply and is the right tool for that (see its
 * own comment on why aggregation belongs in the database). But the ledger
 * summary page's (src/app/page.tsx) month filter needs a month-scoped
 * balance, and the whole journal is already one small fetch
 * (useJournalEntries) — reducing over data already in memory client-side
 * is simpler than adding a parameterized SQL function for a handful of
 * rows.
 *
 * "Month-scoped" means two different things depending on the account, and
 * this function deliberately does NOT apply the same entry-date filter to
 * every account. It is tempting to draw this line at "all balance sheet
 * accounts are cumulative, all P&L accounts are period-only" — asset vs.
 * expense — but that's wrong here: 1210 (BOG) and 1490 (undefined
 * transactions) are assets too, yet each `bank_transactions` row is a
 * one-time event dated within the reporting window (April–June 2026, no
 * historical tail), so "ივნისი" for 1210/1490 should mean "matched/
 * imported specifically in June," the same period-only sense the main
 * reconciliation dashboard already uses for its own monthly stats — NOT a
 * running bank-balance-since-launch. `CUMULATIVE_ACCOUNT_CODES` is
 * therefore an explicit, narrow allowlist rather than a type check:
 *
 * - `1410` (მოთხოვნები) IS cumulative-through-month-end (every entry dated
 *   on or before monthEnd, no lower bound): contract demand recurs every
 *   month a contract is active, going back to each contract's own
 *   start_date (mostly 2025, well before the reporting window) — treating
 *   June as "only June's own new demand minus June's own settlements"
 *   nets one month of new demand against however many months of
 *   accumulated backlog a June payment happened to settle, which can look
 *   negative even though the account's true running balance never was.
 *   Cumulative treatment is also what makes an overpayment in one month
 *   show as a smaller balance the next month "recovering" as new demand
 *   is added — no separate advance/liability account needed.
 * - Everything else — 1210, 1490, revenue/expense accounts like 6000/7420,
 *   and the demo-only 5900 plug — is period-only: entries within
 *   [monthStart, monthEnd]. For 1210/1490 this keeps "Imported = Matched +
 *   Undefined" meaningful per month, not just all-time, and keeps the
 *   ledger's month tabs answering the same question the main dashboard's
 *   month tabs do ("what happened in June specifically").
 *
 * Pass `monthRange` to scope to one month; omit it to get the same all-time
 * total the SQL view would return (useful as a sanity check that this
 * mirrors the view correctly).
 */
const CUMULATIVE_ACCOUNT_CODES = new Set<string>(["1410"]);

export function computeAccountBalances(
  accounts: Account[],
  entries: JournalEntry[],
  monthRange?: MonthRange,
): AccountBalance[] {
  const accountCodeById = new Map(accounts.map((a) => [a.id, a.code]));
  const totals = new Map<string, { debit: number; credit: number }>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (monthRange) {
        const code = accountCodeById.get(line.accountId);
        const isCumulative = code !== undefined && CUMULATIVE_ACCOUNT_CODES.has(code);

        if (isCumulative) {
          if (entry.entryDate > monthRange.monthEnd) continue;
        } else if (
          entry.entryDate < monthRange.monthStart ||
          entry.entryDate > monthRange.monthEnd
        ) {
          continue;
        }
      }

      const running = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
      running.debit += line.debit;
      running.credit += line.credit;
      totals.set(line.accountId, running);
    }
  }

  return accounts.map((account) => {
    const running = totals.get(account.id) ?? { debit: 0, credit: 0 };
    const balance =
      account.normalBalance === "debit"
        ? running.debit - running.credit
        : running.credit - running.debit;

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      isActive: account.isActive,
      balance,
    };
  });
}
