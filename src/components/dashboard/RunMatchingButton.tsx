"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { useRunAutoMatching } from "@/hooks/useTransactionMutations";

export function RunMatchingButton() {
  const { mutate, isPending } = useRunAutoMatching();
  // Intentionally no auto-clear timer: per product decision, the result
  // stays visible until the page is reloaded, so a reviewer/operator can
  // glance back at "how many got matched" without re-running the action.
  const [lastResult, setLastResult] = useState<number | null>(null);

  function handleClick() {
    mutate(undefined, {
      onSuccess: (count) => {
        setLastResult(count);
      },
    });
  }

  return (
    <div className="flex items-center gap-3">
      {/* Positioned to the LEFT of the button in a fixed-width wrapper so
          its appearance never shifts the button's position on the page —
          the slot is reserved from the first render whether or not
          there's a result to show yet. */}
      <div className="min-w-45 text-right">
        {lastResult !== null && (
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
        <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {isPending ? "მუშავება..." : "მატჩინგის გაშვება"}
      </button>
    </div>
  );
}
