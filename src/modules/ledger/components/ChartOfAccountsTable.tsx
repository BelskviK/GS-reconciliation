"use client";

import { cn } from "@/lib/utils/cn";
import type { Account, AccountType } from "@/modules/ledger/types";

interface ChartOfAccountsTableProps {
  accounts: Account[];
  isLoading?: boolean;
}

const TYPE_LABEL: Record<AccountType, string> = {
  asset: "აქტივი",
  liability: "ვალდებულება",
  equity: "კაპიტალი",
  revenue: "შემოსავალი",
  expense: "ხარჯი",
};

const TYPE_ACCENT: Record<AccountType, string> = {
  asset: "text-matched",
  liability: "text-unmatched",
  equity: "text-ink",
  revenue: "text-matched",
  expense: "text-unmatched",
};

export function ChartOfAccountsTable({
  accounts,
  isLoading,
}: ChartOfAccountsTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
        <div className="divide-y divide-hairline">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-12 animate-pulse rounded bg-hairline" />
              <div className="h-4 w-40 flex-1 animate-pulse rounded bg-hairline" />
              <div className="h-4 w-20 animate-pulse rounded bg-hairline" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-paper-raised p-8 text-center">
        <p className="text-sm text-ink-muted">
          ანგარიშთა გეგმა ცარიელია — გაუშვით schema.sql
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-24" />
          <col />
          <col className="w-40" />
          <col className="w-32" />
        </colgroup>
        <thead>
          <tr className="border-b border-hairline bg-paper">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              კოდი
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              დასახელება
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              ტიპი
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              ნორმალური ნაშთი
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {accounts.map((account) => (
            <tr key={account.id} className="hover:bg-paper/60">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-ink-muted">
                {account.code}
              </td>
              <td className="truncate px-4 py-3">{account.name}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "text-xs font-medium",
                    TYPE_ACCENT[account.type],
                  )}
                >
                  {TYPE_LABEL[account.type]}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs uppercase text-ink-muted">
                {account.normalBalance === "debit" ? "დებეტი" : "კრედიტი"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
