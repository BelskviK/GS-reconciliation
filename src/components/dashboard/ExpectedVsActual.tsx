"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { formatGEL } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { StatusDot } from "@/components/ui/StatusBadge";
import { getExpectedAmountForCompanyInMonth } from "@/services/contract.service";
import { exportExpectedVsActualCSV } from "@/lib/utils/exportCSV";
import type { Company, Contract, BankTransaction } from "@/types/domain";
import type { MonthRange } from "@/lib/utils/month";
import { getMonthLabel } from "@/lib/utils/month";

interface ExpectedVsActualRow {
  companyId: string;
  companyName: string;
  taxId: string;
  expected: number;
  actual: number;
  difference: number;
  state: "matched" | "unmatched" | "ignored" | "none";
}

interface ExpectedVsActualProps {
  companies: Company[];
  contracts: Contract[];
  transactions: BankTransaction[];
  monthRange: MonthRange;
  monthKey: string;
  isLoading?: boolean;
}

function buildRows(
  companies: Company[],
  contracts: Contract[],
  transactions: BankTransaction[],
  monthRange: MonthRange,
): ExpectedVsActualRow[] {
  const matchedByCompany = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.status === "matched" && tx.matchedCompanyId) {
      matchedByCompany.set(
        tx.matchedCompanyId,
        (matchedByCompany.get(tx.matchedCompanyId) ?? 0) + tx.amount,
      );
    }
  }

  return companies
    .map((company) => {
      const expected = getExpectedAmountForCompanyInMonth(
        contracts,
        company.id,
        monthRange.monthStart,
        monthRange.monthEnd,
      );
      const actual = matchedByCompany.get(company.id) ?? 0;
      const difference = actual - expected;
      const state: ExpectedVsActualRow["state"] =
        expected === 0 && actual === 0
          ? "none"
          : actual >= expected
            ? "matched"
            : "unmatched";
      return { companyId: company.id, companyName: company.name, taxId: company.taxId, expected, actual, difference, state };
    })
    .filter((r) => r.expected > 0 || r.actual > 0)
    .sort((a, b) => b.expected - a.expected);
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="h-4 w-32 flex-1 animate-pulse rounded bg-hairline" />
      <div className="h-4 w-20 animate-pulse rounded bg-hairline" />
      <div className="h-4 w-20 animate-pulse rounded bg-hairline" />
      <div className="h-4 w-20 animate-pulse rounded bg-hairline" />
    </div>
  );
}

export function ExpectedVsActual({
  companies,
  contracts,
  transactions,
  monthRange,
  monthKey,
  isLoading,
}: ExpectedVsActualProps) {
  const rows = useMemo(
    () => buildRows(companies, contracts, transactions, monthRange),
    [companies, contracts, transactions, monthRange],
  );

  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalDiff = totalActual - totalExpected;

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
        <div className="divide-y divide-hairline">
          <RowSkeleton /><RowSkeleton /><RowSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="text-xs text-ink-muted">{rows.length} კომპანია</span>
        <button
          onClick={() =>
            exportExpectedVsActualCSV(
              companies,
              contracts,
              transactions,
              monthRange,
              getMonthLabel(monthKey),
            )
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-ink hover:text-ink"
        >
          <Download className="h-3.5 w-3.5" />
          CSV ექსპორტი
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-paper">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">კომპანია</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">მოსალოდნელი</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">ფაქტობრივი</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">სხვაობა</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <tr key={row.companyId} className="hover:bg-paper/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusDot status={row.state} />
                    <span>{row.companyName}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-ink-muted">{formatGEL(row.expected)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium">{formatGEL(row.actual)}</td>
                <td className={cn(
                  "whitespace-nowrap px-4 py-3 text-right font-mono font-medium",
                  row.difference > 0 && "text-matched",
                  row.difference < 0 && "text-unmatched",
                  row.difference === 0 && "text-ink-muted",
                )}>
                  {row.difference > 0 ? "+" : ""}{formatGEL(row.difference)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-hairline bg-paper">
              <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">სულ</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-ink-muted">{formatGEL(totalExpected)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">{formatGEL(totalActual)}</td>
              <td className={cn(
                "whitespace-nowrap px-4 py-3 text-right font-mono font-semibold",
                totalDiff > 0 && "text-matched",
                totalDiff < 0 && "text-unmatched",
                totalDiff === 0 && "text-ink-muted",
              )}>
                {totalDiff > 0 ? "+" : ""}{formatGEL(totalDiff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
