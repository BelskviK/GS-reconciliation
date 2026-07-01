"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TransactionStatus } from "@/types/domain";

interface StatusMultiSelectProps {
  selected: TransactionStatus[];
  onChange: (statuses: TransactionStatus[]) => void;
}

const ALL_STATUSES: Array<{
  value: TransactionStatus;
  label: string;
  dot: string;
}> = [
  { value: "matched", label: "დამთხვეული", dot: "bg-matched" },
  { value: "unmatched", label: "შეუსაბამო", dot: "bg-unmatched" },
  { value: "ignored", label: "იგნორირებული", dot: "bg-ignored" },
];

export function StatusMultiSelect({
  selected,
  onChange,
}: StatusMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function toggle(status: TransactionStatus) {
    if (selected.includes(status)) {
      const next = selected.filter((s) => s !== status);
      onChange(next);
    } else {
      onChange([...selected, status]);
    }
  }

  // Label shown on the column header button
  const buttonLabel =
    selected.length === 0
      ? "სტატუსი"
      : selected.length === 1
        ? (ALL_STATUSES.find((s) => s.value === selected[0])?.label ??
          "სტატუსი")
        : `${selected.length} სტატუსი`;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors",
          selected.length > 0 ? "text-ink" : "text-ink-muted hover:text-ink",
        )}
      >
        {buttonLabel}
        <ChevronDown className="h-3 w-3" />
        {selected.length > 0 && (
          <span className="ml-0.5 rounded-full bg-ink px-1.5 text-[10px] font-semibold text-paper-raised">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-hairline bg-paper-raised py-1 shadow-lg">
          {ALL_STATUSES.map((s) => {
            const isChecked = selected.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggle(s.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm normal-case hover:bg-paper"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isChecked
                      ? "border-ink bg-ink text-paper-raised"
                      : "border-hairline",
                  )}
                >
                  {isChecked && <Check className="h-3 w-3" />}
                </span>
                <span
                  className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
