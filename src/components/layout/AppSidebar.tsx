"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LedgerSidebar } from "@/modules/ledger/components/LedgerSidebar";

const RECONCILIATION_HREF = "/reconciliation";

/**
 * Global app shell sidebar, mounted once in src/app/layout.tsx so every
 * route gets the same navigation — there is no longer a separate /ledger
 * layout tree. Two sections:
 *
 * 1. A single, deliberately loud link back to /reconciliation — the
 *    original assignment's required deliverable. Everything else in this
 *    app (the ledger pages this sidebar's second section links to) is the
 *    additive "recommendation branch" described in docs/ARCHITECTURE.md;
 *    this link and its "ეს არის დავალება" label exist so that distinction
 *    is visible on every page, not just in a doc someone might not read.
 *    Bordered and colored differently from the rest of the nav on purpose
 *    — it should not blend in with the ledger's own items below it.
 * 2. LedgerSidebar — just the nav now. The "მატჩინგის გაშვება" button that
 *    used to render here moved into each ledger page's own header (same
 *    position as /reconciliation's own copy of the button) — see
 *    LedgerMatchButton's comment for why.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const isReconciliation = pathname === RECONCILIATION_HREF;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 sm:w-56">
      <div>
        <Link
          href={RECONCILIATION_HREF}
          className={cn(
            "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors",
            isReconciliation
              ? "border-ink bg-ink text-paper-raised"
              : "border-unmatched/50 bg-unmatched-bg text-unmatched hover:border-unmatched",
          )}
        >
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          <span className="flex-1 whitespace-nowrap">
            შედარების დეშბორდი
          </span>
        </Link>
        <p
          className={cn(
            "mt-1 px-1 text-[10px] font-semibold uppercase tracking-wide",
            isReconciliation ? "text-ink" : "text-unmatched",
          )}
        >
          ეს არის დავალება
        </p>
      </div>

      <div className="h-px bg-hairline" />

      <LedgerSidebar />
    </aside>
  );
}
