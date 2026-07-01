"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { suggestCompanyMatches } from "@/lib/utils/fuzzyMatch";
import type { Company, BankTransaction } from "@/types/domain";

interface CompanyMatchSelectProps {
  transaction: BankTransaction;
  companies: Company[];
  onSelect: (companyId: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

function scoreColor(percent: number): string {
  if (percent >= 70) return "text-matched";
  if (percent >= 40) return "text-amber-600";
  return "text-ink-muted";
}

export function CompanyMatchSelect({
  transaction,
  companies,
  onSelect,
  onRemove,
  disabled,
}: CompanyMatchSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = suggestCompanyMatches(transaction, companies, 5);
  const currentCompany = companies.find(
    (c) => c.id === transaction.matchedCompanyId,
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function handleSelect(companyId: string) {
    onSelect(companyId);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-left text-sm transition-colors hover:border-hairline disabled:opacity-50"
      >
        <span className={currentCompany ? "" : "text-ink-muted"}>
          {currentCompany?.name ?? "— აირჩიეთ —"}
        </span>
        <ChevronDown className="h-3 w-3 text-ink-muted" />
      </button>

      {currentCompany && onRemove && (
        <button
          onClick={onRemove}
          disabled={disabled}
          title="კომპანიის მოხსნა"
          className="rounded p-0.5 text-ink-muted hover:bg-unmatched-bg hover:text-unmatched disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-hairline bg-paper-raised py-1 shadow-lg">
          {suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-ink-muted">
              შესაბამისი კომპანია ვერ მოიძებნა
            </div>
          )}
          {suggestions.map((s, idx) => (
            <button
              key={s.company.id}
              onClick={() => handleSelect(s.company.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-paper",
                idx === 0 && "bg-matched-bg/40",
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {s.company.id === transaction.matchedCompanyId && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-matched" />
                )}
                <span className="truncate">{s.company.name}</span>
              </span>
              <span className={cn("shrink-0 font-mono text-xs font-medium", scoreColor(s.scorePercent))}>
                {s.scorePercent}%
              </span>
            </button>
          ))}

          <div className="my-1 border-t border-hairline" />
          <details className="px-3 py-1">
            <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
              ყველა კომპანია...
            </summary>
            <div className="mt-1 max-h-48 overflow-y-auto">
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className="block w-full truncate px-1 py-1.5 text-left text-xs hover:bg-paper"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
