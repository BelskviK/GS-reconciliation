"use client";

import { useState, useMemo, useEffect } from "react";
import { useCompanies } from "@/hooks/useCompanies";
import { useContracts } from "@/hooks/useContracts";
import { useTransactions } from "@/hooks/useTransactions";
import {
  useUpdateTransactionStatus,
  useManuallyMatchTransaction,
  useUpdateTransactionComment,
  useUnmatchTransaction,
} from "@/hooks/useTransactionMutations";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { MonthTabs } from "@/components/dashboard/MonthTabs";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import { ExpectedVsActual } from "@/components/dashboard/ExpectedVsActual";
import { RunMatchingButton } from "@/components/dashboard/RunMatchingButton";
import { getLastNMonths, getMonthRange } from "@/lib/utils/month";
import type { MonthOption } from "@/lib/utils/month";
import type { TransactionStatus } from "@/types/domain";

function useAvailableMonths(): MonthOption[] {
  return useMemo(() => getLastNMonths(4), []);
}

/**
 * The required reconciliation dashboard — this is "the task" the
 * assignment actually asks for. It used to live at `/`; the app's root
 * now shows the ledger recommendation branch's Summary page instead (see
 * src/app/page.tsx), and AppSidebar's bordered, labeled "ეს არის
 * დავალება" link is what brings people back here. Nothing about this
 * page's own behavior changed in that move — it still doesn't know the
 * ledger exists (see docs/ARCHITECTURE.md), and its own
 * "მატჩინგის გაშვება" button below is the same mutation as every other
 * copy of that button anywhere in the app.
 */
export default function ReconciliationDashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  // Default to showing only "unmatched" transactions
  const [statusFilter, setStatusFilter] = useState<TransactionStatus[]>([
    "unmatched",
  ]);
  const [search, setSearch] = useState("");

  const availableMonths = useAvailableMonths();

  // Default to the most recent available month
  useEffect(() => {
    if (selectedMonth === null && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[availableMonths.length - 1].key);
    }
  }, [availableMonths, selectedMonth]);

  const monthRange = useMemo(
    () => (selectedMonth ? getMonthRange(selectedMonth) : null),
    [selectedMonth],
  );

  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data: contracts, isLoading: contractsLoading } = useContracts();

  const { data: monthTransactions, isLoading: monthTxLoading } =
    useTransactions(
      monthRange
        ? { monthStart: monthRange.monthStart, monthEnd: monthRange.monthEnd }
        : {},
    );

  // Only pass a single status to API if exactly one is selected
  const { data: tableTransactions, isLoading: tableLoading } = useTransactions(
    monthRange
      ? {
          monthStart: monthRange.monthStart,
          monthEnd: monthRange.monthEnd,
          ...(statusFilter.length === 1 ? { status: statusFilter[0] } : {}),
          search,
        }
      : {},
  );

  // Client-side filtering for multiple statuses
  const filteredTransactions = useMemo(() => {
    if (!tableTransactions) return [];
    // If no status filter, return all
    if (statusFilter.length === 0) {
      return tableTransactions;
    }
    // Filter by selected statuses
    return tableTransactions.filter((tx) => statusFilter.includes(tx.status));
  }, [tableTransactions, statusFilter]);

  const updateStatus = useUpdateTransactionStatus();
  const manualMatch = useManuallyMatchTransaction();
  const updateComment = useUpdateTransactionComment();
  const unmatch = useUnmatchTransaction();

  const pendingActionId = updateStatus.isPending
    ? updateStatus.variables?.transactionId
    : manualMatch.isPending
      ? manualMatch.variables?.transactionId
      : unmatch.isPending
        ? unmatch.variables
        : null;

  if (!selectedMonth) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-ink-muted">მონაცემები იტვირთება...</p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            გადახდების შედარების დეშბორდი
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            საბანკო ტრანზაქციების შესაბამისობა ხელშეკრულებებთან
          </p>
        </div>
        <RunMatchingButton />
      </header>

      <div className="mb-6">
        <MonthTabs
          months={availableMonths}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
        />
      </div>

      <div className="mb-8">
        <StatsBar
          transactions={monthTransactions ?? []}
          isLoading={monthTxLoading}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          ტრანზაქციები
        </h2>
        <div className="mb-3">
          <FilterBar
            status={statusFilter}
            search={search}
            onStatusChange={setStatusFilter}
            onSearchChange={setSearch}
          />
        </div>
        <TransactionsTable
          transactions={filteredTransactions}
          companies={companies ?? []}
          isLoading={tableLoading}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onIgnore={(id) =>
            updateStatus.mutate({ transactionId: id, status: "ignored" })
          }
          onUnignore={(id) =>
            updateStatus.mutate({ transactionId: id, status: "unmatched" })
          }
          onManualMatch={(id, companyId) =>
            manualMatch.mutate({ transactionId: id, companyId })
          }
          onUnmatch={(id) => unmatch.mutate(id)}
          onCommentSave={(id, comment) =>
            updateComment.mutate({ transactionId: id, comment })
          }
          pendingActionId={pendingActionId}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          მოსალოდნელი vs ფაქტობრივი
        </h2>
        {monthRange && (
          <ExpectedVsActual
            companies={companies ?? []}
            contracts={contracts ?? []}
            transactions={monthTransactions ?? []}
            monthRange={monthRange}
            monthKey={selectedMonth}
            isLoading={companiesLoading || contractsLoading || monthTxLoading}
          />
        )}
      </section>
    </div>
  );
}
