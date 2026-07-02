"use client";

import { useEffect, useMemo, useState } from "react";
import { useJournalEntries } from "@/modules/ledger/hooks/useJournalEntries";
import { JournalEntriesTable } from "@/modules/ledger/components/JournalEntriesTable";
import { MonthTabs } from "@/components/dashboard/MonthTabs";
import { getLastNMonths } from "@/lib/utils/month";
import type { MonthOption } from "@/lib/utils/month";

/**
 * Same getLastNMonths(4) /reconciliation uses for its MonthTabs —
 * dynamic, relative to today, not derived from whatever's in the data —
 * defaulting to the most recent month, same as /reconciliation. There is
 * no "all months" option anymore (removed on purpose). The real
 * consequence: a contract's demand entries dated outside this 4-month
 * window (see post_contract_demand() in schema.sql — each dated at its
 * contract's own start_date, which can be well over a year back) are not
 * reachable from this page's filter at all anymore. They still exist and
 * are still correctly summed into /'s cumulative 1410 balance (that
 * computation reads every fetched entry, not just the ones this page's
 * filter currently shows) — this page just can't display them
 * individually any more. Flagged here rather than silently dropped.
 */

// Even a single month can hold a lot of entries — 18 contracts' worth of
// monthly demand plus every transaction import/match dated that month —
// and JournalEntriesTable renders each one as its own card with a full
// debit/credit table inside, which gets visibly slow past a couple
// hundred rows. Paginated client-side on top of the month filter rather
// than changing how much useJournalEntries() fetches: / (the Summary
// page) still needs every entry, unfiltered, for its cumulative 1410
// balance, so trimming the query itself isn't an option here.
const PAGE_SIZE = 25;

export default function LedgerJournalPage() {
  const { data: entries, isLoading } = useJournalEntries();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const monthOptions: MonthOption[] = useMemo(() => getLastNMonths(4), []);

  useEffect(() => {
    if (selectedMonth === null && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[monthOptions.length - 1].key);
    }
  }, [monthOptions, selectedMonth]);

  const filteredEntries = useMemo(() => {
    if (!entries || !selectedMonth) return [];
    return entries.filter((e) => e.entryDate.startsWith(selectedMonth));
  }, [entries, selectedMonth]);

  // Back to page 1 any time the month changes — otherwise switching from
  // a month with 8 pages to one with 1 page can leave you on a blank page.
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));

  // Safety net for the same "fewer pages than before" case if entries
  // themselves change size (e.g. a refetch after matching) while sitting
  // on a page number that no longer exists.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedEntries = filteredEntries.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  if (!selectedMonth) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-ink-muted">მონაცემები იტვირთება...</p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          ჟურნალის გატარებები
        </h2>
        <div className="overflow-x-auto">
          <MonthTabs
            months={monthOptions}
            selected={selectedMonth}
            onSelect={setSelectedMonth}
          />
        </div>
      </div>
      <JournalEntriesTable
        entries={paginatedEntries}
        isLoading={isLoading}
        emptyMessage={
          (entries?.length ?? 0) > 0
            ? "ამ თვეში გატარებები არ არის — სცადეთ სხვა თვე"
            : undefined
        }
      />

      {!isLoading && totalPages > 1 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-ink-muted">
            ნაჩვენებია {pageStart + 1}–
            {Math.min(pageStart + PAGE_SIZE, filteredEntries.length)} /{" "}
            {filteredEntries.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              წინა
            </button>
            <span className="min-w-16 text-center text-xs tabular-nums text-ink-muted">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              შემდეგი
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
