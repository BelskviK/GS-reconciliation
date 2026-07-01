// src\components\dashboard\MonthTabs.tsx
"use client";

import { cn } from "@/lib/utils/cn";
import type { MonthOption } from "@/lib/utils/month";

interface MonthTabsProps {
  months: MonthOption[];
  selected: string;
  onSelect: (month: string) => void;
}

export function MonthTabs({ months, selected, onSelect }: MonthTabsProps) {
  if (months.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="თვის არჩევა"
      className="inline-flex rounded-lg border border-hairline bg-paper-raised p-1"
    >
      {months.map((month) => {
        const isActive = month.key === selected;
        return (
          <button
            key={month.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(month.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-ink text-paper-raised"
                : "text-ink-muted hover:bg-hairline/50 hover:text-ink",
            )}
          >
            {month.label}
          </button>
        );
      })}
    </div>
  );
}
