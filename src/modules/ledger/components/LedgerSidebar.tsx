"use client";

import { LedgerNav } from "@/modules/ledger/components/LedgerNav";
import { useMatchHighlight } from "@/modules/ledger/context/MatchHighlightContext";

/**
 * Just the nav now. LedgerMatchButton used to render here too, but it
 * moved into each ledger page's own header (same position as
 * RunMatchingButton on /reconciliation) — see LedgerMatchButton's own
 * comment for why. LedgerSidebar still needs to know when a match just
 * posted, though, so LedgerNav's "+N" badge on "ჟურნალის გატარებები"
 * lights up regardless of which page's copy of the button was actually
 * clicked — MatchHighlightContext (provided once in app/layout.tsx,
 * above both this sidebar and page content) is what makes that possible
 * now that the button and this nav are siblings instead of parent/child.
 */
export function LedgerSidebar() {
  const { journalHighlightCount } = useMatchHighlight();

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 sm:w-56">
      <LedgerNav journalHighlightCount={journalHighlightCount} />
    </div>
  );
}
