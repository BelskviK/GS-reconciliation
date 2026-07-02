"use client";

import { cn } from "@/lib/utils/cn";
import { formatGEL, formatDate } from "@/lib/utils/format";
import type { JournalEntry } from "@/modules/ledger/types";

interface JournalEntriesTableProps {
  entries: JournalEntry[];
  isLoading?: boolean;
  /**
   * Override for the empty-state message. Defaults to "nothing posted
   * yet, run the migrations" — wrong when `entries` is empty only
   * because a month filter matched nothing, not because the ledger is
   * genuinely empty. See src/app/journal/page.tsx.
   */
  emptyMessage?: React.ReactNode;
}

function isBalanced(entry: JournalEntry): boolean {
  const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

export function JournalEntriesTable({
  entries,
  isLoading,
  emptyMessage,
}: JournalEntriesTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
        <div className="divide-y divide-hairline">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-20 animate-pulse rounded bg-hairline" />
              <div className="h-4 w-56 flex-1 animate-pulse rounded bg-hairline" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-paper-raised p-8 text-center">
        <p className="text-sm text-ink-muted">
          {emptyMessage ?? "ჯერ არცერთი გატარება არ არსებობს — გაუშვით schema.sql"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => {
        const balanced = isBalanced(entry);
        return (
          <div
            key={entry.id}
            className="overflow-hidden rounded-xl border border-hairline bg-paper-raised"
          >
            <div className="flex items-center justify-between border-b border-hairline bg-paper px-4 py-3">
              <div>
                <div className="font-mono text-xs text-ink-muted">
                  {formatDate(entry.entryDate)}
                </div>
                <div className="text-sm">
                  {entry.description ?? "აღწერის გარეშე"}
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  balanced
                    ? "bg-matched-bg text-matched"
                    : "bg-unmatched-bg text-unmatched",
                )}
                title="sum(debit) = sum(credit) შემოწმება ამ გატარებისთვის"
              >
                {balanced ? "დაბალანსებული" : "დაუბალანსებელი"}
              </span>
            </div>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col />
                <col className="w-32" />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr className="border-b border-hairline">
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    ანგარიში
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                    დებეტი
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                    კრედიტი
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {entry.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="truncate px-4 py-2">
                      <span className="font-mono text-xs text-ink-muted">
                        {line.accountCode}
                      </span>{" "}
                      {line.accountName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                      {line.debit > 0 ? formatGEL(line.debit) : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                      {line.credit > 0 ? formatGEL(line.credit) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
