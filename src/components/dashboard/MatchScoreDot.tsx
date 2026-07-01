"use client";

import { cn } from "@/lib/utils/cn";
import { suggestCompanyMatches } from "@/lib/utils/fuzzyMatch";
import type { Company, BankTransaction } from "@/types/domain";

interface MatchScoreDotProps {
  transaction: BankTransaction;
  companies: Company[];
}

/**
 * Small colored dot + percentage showing how well the transaction's
 * sender matches its currently assigned company (or, for unmatched
 * transactions, the best available suggestion). This is a fuzzy-name
 * confidence signal, distinct from match_confidence in the DB (which is
 * always 1.00 for inn_exact matches — those don't need a fuzzy score).
 */
export function MatchScoreDot({ transaction, companies }: MatchScoreDotProps) {
  const suggestions = suggestCompanyMatches(transaction, companies, 1);
  const topSuggestion = suggestions[0];

  const isExactMatch = transaction.matchMethod === "inn_exact";
  const percent = isExactMatch ? 100 : (topSuggestion?.scorePercent ?? 0);

  const colorClass =
    percent >= 70
      ? "bg-matched"
      : percent >= 40
        ? "bg-amber-500"
        : "bg-ignored";

  return (
    <span
      className="inline-flex items-center gap-1 mr-1"
      title={`სანდოობა: ${percent}%${
        topSuggestion && !isExactMatch ? ` (${topSuggestion.company.name})` : ""
      }`}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colorClass)} />
      <span className="font-mono text-[10px] text-ink-muted">{percent}%</span>
    </span>
  );
}
