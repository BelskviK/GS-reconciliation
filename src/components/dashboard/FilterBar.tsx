"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { transactionFiltersSchema } from "@/schemas/transactionFilters";
import type { TransactionStatus } from "@/types/domain";

interface FilterBarProps {
  status: TransactionStatus[];
  search: string;
  onStatusChange: (statuses: TransactionStatus[]) => void;
  onSearchChange: (search: string) => void;
}

const STATUS_OPTIONS: Array<{
  value: TransactionStatus;
  label: string;
}> = [
  { value: "matched", label: "Matched" },
  { value: "unmatched", label: "Unmatched" },
  { value: "ignored", label: "Ignored" },
];

export function FilterBar({
  status,
  search,
  onStatusChange,
  onSearchChange,
}: FilterBarProps) {
  function handleSearchChange(value: string) {
    const result = transactionFiltersSchema.shape.search.safeParse(value);
    onSearchChange(result.success ? result.data : value.slice(0, 200));
  }

  function toggleStatus(statusValue: TransactionStatus) {
    if (status.includes(statusValue)) {
      // Remove the status
      const next = status.filter((s) => s !== statusValue);
      onStatusChange(next);
    } else {
      // Add the status
      onStatusChange([...status, statusValue]);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex rounded-lg border border-hairline bg-paper-raised p-1 gap-1">
        {/* Individual status buttons */}
        {STATUS_OPTIONS.map((option) => {
          const isActive = status.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggleStatus(option.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-ink text-paper-raised"
                  : "text-ink-muted hover:bg-hairline/50 hover:text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="ძებნა სახელით ან ს/კ-ით..."
          className="w-full rounded-lg border border-hairline bg-paper-raised py-1.5 pl-9 pr-3 text-sm outline-none placeholder:text-ink-muted focus:border-ink"
        />
      </div>
    </div>
  );
}
