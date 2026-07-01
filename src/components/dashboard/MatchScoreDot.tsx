"use client";

import { cn } from "@/lib/utils/cn";
import {
  scoreCompanyMatch,
  suggestCompanyMatches,
} from "@/lib/utils/fuzzyMatch";
import type { Company, BankTransaction } from "@/types/domain";

interface MatchScoreDotProps {
  transaction: BankTransaction;
  companies: Company[];
}

/**
 * Small colored dot + percentage showing how well the transaction's
 * sender NAME matches its currently assigned company (or, for unmatched
 * transactions, the best available suggestion). This is deliberately a
 * pure fuzzy-name signal, always computed from scoreCompanyMatch() — it
 * is NOT the same thing as match_confidence in the DB (which is always
 * 1.00 for inn_exact, since that's a tax-ID equality check, not a name
 * comparison). Don't special-case inn_exact to a hardcoded 100% here: an
 * inn_exact match can still have a genuinely low name-similarity score
 * (e.g. "გეოტრანსი (ფილიალი)" vs "შპს გეოტრანსი" — same tax ID, ~88%
 * name match), and that's precisely the useful signal this dot exists
 * to surface. Using scoreCompanyMatch() (the same function
 * CompanyMatchSelect's dropdown uses per-row) also keeps this dot's
 * percentage identical to the {s.scorePercent}% shown next to that
 * company there, for both inn_exact and manual matches.
 */
export function MatchScoreDot({ transaction, companies }: MatchScoreDotProps) {
  const matchedCompany = companies.find(
    (c) => c.id === transaction.matchedCompanyId,
  );

  let percent: number;
  let suggestionLabel: string | undefined;

  if (matchedCompany) {
    percent = scoreCompanyMatch(transaction, matchedCompany).scorePercent;
  } else {
    // Unmatched: fall back to the best available suggestion as a hint.
    const topSuggestion = suggestCompanyMatches(transaction, companies, 1)[0];
    percent = topSuggestion?.scorePercent ?? 0;
    suggestionLabel = topSuggestion?.company.name;
  }

  const colorClass =
    percent >= 70
      ? "bg-matched"
      : percent >= 40
        ? "bg-amber-500"
        : "bg-ignored";

  return (
    <span
      className="inline-flex items-center gap-1"
      title={`სანდოობა: ${percent}%${
        suggestionLabel ? ` (${suggestionLabel})` : ""
      }`}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colorClass)} />
      <span className="font-mono text-[10px] text-ink-muted">{percent}%</span>
    </span>
  );
}
