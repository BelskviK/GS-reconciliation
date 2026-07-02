"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "@/modules/ledger/hooks/useAccounts";
import { useJournalEntries } from "@/modules/ledger/hooks/useJournalEntries";
import { computeAccountBalances } from "@/modules/ledger/utils/computeAccountBalances";
import { BalanceSheetPanel } from "@/modules/ledger/components/BalanceSheetPanel";
import { ProfitAndLossPanel } from "@/modules/ledger/components/ProfitAndLossPanel";
import { LedgerMatchButton } from "@/modules/ledger/components/LedgerMatchButton";
import { MonthTabs } from "@/components/dashboard/MonthTabs";
import { getLastNMonths, getMonthRange } from "@/lib/utils/month";
import type { MonthOption } from "@/lib/utils/month";

/**
 * Summary — a balance sheet + P&L rollup, and the app's default landing
 * page. Always scoped to one of the last 4 months, defaulting to the
 * most recent — same getLastNMonths(4) /reconciliation uses, same
 * "default to the latest" behavior. There is no "all months" option
 * anymore (removed on purpose); the account_balances SQL view it used to
 * read for that is still defined in schema.sql, just unused by this page
 * now. Balances are recomputed client-side from the same journal entries
 * useJournalEntries() already fetches — see computeAccountBalances() for
 * why "scoped to a month" means cumulative-through-month-end for 1410
 * specifically, but period-only activity for every other account,
 * including 1210/1490 (assets too, but without 1410's multi-month
 * accrual history), and why that split matters. Because that computation
 * reads every fetched entry (not just ones within the selected month), a
 * contract's older demand — dated well before the 4-month window, back
 * at the contract's own start_date — still correctly rolls into 1410's
 * cumulative balance for whichever month is selected here, even though
 * there is no month tab that shows that older entry directly (see
 * /journal for where that limitation actually bites).
 *
 * This page itself only reads; the live posting happens via the DB
 * triggers in schema.sql reacting to `contracts` inserts and
 * bank_transactions.status changes, triggered either from the required
 * reconciliation dashboard's own "მატჩინგის გაშვება" button (see
 * /reconciliation) or this page's own copy of the same button, in the
 * header below — same position as /reconciliation's, see
 * LedgerMatchButton. Before the first match, 1210 საბანკო
 * ანგარიშსწორება (BOG) reads 0 here and 1490 დაუდგენელი ტრანზაქციები
 * holds the full imported total — see docs/ARCHITECTURE.md section 4.2
 * for the full before/after walkthrough.
 */
export default function LedgerSummaryPage() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const monthOptions: MonthOption[] = useMemo(() => getLastNMonths(4), []);

  // Default to the most recent available month, same pattern
  // /reconciliation uses for its own MonthTabs.
  useEffect(() => {
    if (selectedMonth === null && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[monthOptions.length - 1].key);
    }
  }, [monthOptions, selectedMonth]);

  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: entries, isLoading: entriesLoading } = useJournalEntries();

  const isLoading = accountsLoading || entriesLoading;

  const balances = useMemo(() => {
    if (!selectedMonth || !accounts || !entries) return [];
    return computeAccountBalances(
      accounts,
      entries,
      getMonthRange(selectedMonth),
    );
  }, [selectedMonth, accounts, entries]);

  if (!selectedMonth) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-ink-muted">მონაცემები იტვირთება...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            სააღრიცხვო წიგნი — შეჯამება
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            ბალანსი და მოგება-ზარალის უწყისი — არქიტექტურის მიმოხილვა (იხ.{" "}
            <code className="rounded bg-paper px-1 py-0.5 text-xs">
              docs/ARCHITECTURE.md
            </code>
            )
          </p>
        </div>
        <LedgerMatchButton />
      </header>

      <div className="overflow-x-auto">
        <MonthTabs
          months={monthOptions}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
        />
      </div>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            ბალანსი — ამ თვის აქტივობა
          </h2>
          <BalanceSheetPanel balances={balances} isLoading={isLoading} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            მოგება-ზარალის უწყისი — ამ თვის აქტივობა
          </h2>
          <ProfitAndLossPanel balances={balances} isLoading={isLoading} />
        </section>
      </div>
    </div>
  );
}
