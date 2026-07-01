"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useRunAutoMatching } from "@/hooks/useTransactionMutations";

export function RunMatchingButton() {
  const { mutate, isPending, isError, error } = useRunAutoMatching();
  const [lastResult, setLastResult] = useState<number | null>(null);
  const [showError, setShowError] = useState(true);

  function handleClick() {
    setLastResult(null);
    setShowError(true);
    mutate(undefined, {
      onSuccess: (count) => {
        setLastResult(count);
      },
    });
  }

  function handleCloseError() {
    setShowError(false);
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          <div className="min-w-45 text-right">
            {lastResult !== null && !isError && (
              <span className="inline-flex items-center gap-1.5 text-sm text-matched">
                <CheckCircle2 className="h-4 w-4" />
                {lastResult} ტრანზაქცია დამთხვეული
              </span>
            )}
          </div>
          <button
            onClick={handleClick}
            disabled={isPending}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper-raised transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw
              className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            {isPending ? "მუშავება..." : "მატჩინგის გაშვება"}
          </button>
        </div>
      </div>

      {/* Error Toast - Centered on screen */}
      {isError && showError && (
        <div className="fixed inset-0 flex items-start justify-center pointer-events-none z-50 px-4 pt-8">
          <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-unmatched/30 bg-unmatched-bg px-4 py-3 text-sm text-unmatched shadow-lg">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <span className="min-w-0 flex-1 wrap-break-word break-all">
              {error instanceof Error
                ? error.message
                : "მატჩინგის გაშვება ვერ მოხერხდა."}
            </span>
            <button
              onClick={handleCloseError}
              className="shrink-0 rounded-md p-1 -mr-1 -mt-1 hover:bg-black/5 transition-colors"
              aria-label="Close error message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
