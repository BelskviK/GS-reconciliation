"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { transactionFiltersSchema } from "@/schemas/transactionFilters";
import type { TransactionStatus } from "@/types/domain";

const SEARCH_DEBOUNCE_MS = 300;

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
  // Local, immediate input value — typing always feels instant. The
  // debounced value is what actually gets pushed up to the parent (and
  // from there into the TanStack Query key / Supabase call), so a fast
  // typist doesn't fire a network request per keystroke. Clearing the
  // input is the one path that intentionally SKIPS the debounce: the
  // user expects the list to reset the moment they hit the X, not
  // 300ms later.
  const [inputValue, setInputValue] = useState(search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay in sync if `search` is reset externally (e.g. month switch).
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  function parseSearch(value: string): string {
    const result = transactionFiltersSchema.shape.search.safeParse(value);
    return result.success ? result.data : value.slice(0, 200);
  }

  function handleSearchChange(rawValue: string) {
    const value = parseSearch(rawValue);
    setInputValue(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onSearchChange(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleClear() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setInputValue("");
    onSearchChange(""); // fires immediately — no debounce wait on clear
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
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="ძებნა სახელით ან ს/კ-ით..."
          className="w-full rounded-lg border border-hairline bg-paper-raised py-1.5 pl-9 pr-8 text-sm outline-none placeholder:text-ink-muted focus:border-ink"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="ძებნის გასუფთავება"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:bg-hairline/50 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
