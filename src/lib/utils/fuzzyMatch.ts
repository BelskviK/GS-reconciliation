import type { Company, BankTransaction } from "@/types/domain";

/**
 * Dice's coefficient (bigram overlap) string similarity, 0..1.
 * Chosen over Levenshtein because it handles word-order variance and
 * partial substring matches better for company names — e.g.
 * "გეოტრანსი (ფილიალი)" vs "შპს გეოტრანსი" share most of their bigrams
 * despite very different edit distance.
 */
function bigrams(str: string): Set<string> {
  const normalized = str.trim().toLowerCase().replace(/\s+/g, " ");
  const result = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    result.add(normalized.slice(i, i + 2));
  }
  return result;
}

function diceCoefficient(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.size === 0 || bigramsB.size === 0) return a === b ? 1 : 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Tax ID similarity: exact match scores 1, shared prefix scores
 * proportionally (e.g. a 6/9-digit shared prefix on a 9-digit Georgian
 * tax ID scores ~0.67). Unrelated IDs with no common prefix score 0.
 * This catches the case of a typo'd or partially-OCR'd INN, which
 * exact-match (the RPC's job) deliberately does not handle.
 */
function taxIdPrefixSimilarity(a: string | null, b: string): number {
  if (!a) return 0;
  if (a === b) return 1;
  let sharedPrefixLen = 0;
  const maxLen = Math.min(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    if (a[i] !== b[i]) break;
    sharedPrefixLen++;
  }
  return sharedPrefixLen / Math.max(a.length, b.length);
}

export interface CompanyMatchSuggestion {
  company: Company;
  score: number; // 0..1
  scorePercent: number; // 0..100, rounded
}

/**
 * Combined suggestion score for one specific transaction/company pair:
 * name similarity is the primary signal (companies rarely share name
 * substrings by coincidence), tax ID prefix similarity is a secondary
 * boost (catches typo'd INNs that still mostly match). Weighted 60/40
 * toward name, since a transaction with a wildly different name but a
 * near-identical tax ID is a much stronger signal of a real match than
 * the reverse.
 *
 * Exported on its own (not just inlined inside suggestCompanyMatches)
 * so any UI showing "how well does this transaction match company X"
 * for a single, already-known company — e.g. the currently assigned
 * company on a manually-matched transaction — computes the exact same
 * number as the suggestion list does for that company. Two separate
 * implementations of the same formula would drift the moment one of
 * them got tweaked.
 */
export function scoreCompanyMatch(
  transaction: BankTransaction,
  company: Company,
): CompanyMatchSuggestion {
  const senderName = transaction.senderName ?? "";
  const senderInn = transaction.senderInn;

  const nameScore = diceCoefficient(senderName, company.name);
  const taxScore = taxIdPrefixSimilarity(senderInn, company.taxId);
  const combined = nameScore * 0.6 + taxScore * 0.4;

  return {
    company,
    score: combined,
    scorePercent: Math.round(combined * 100),
  };
}

/**
 * Ranks every company against a transaction and returns the top `limit`
 * candidates, for the "pick a company" suggestion list. Built on top of
 * scoreCompanyMatch() so the per-company numbers here are identical to
 * whatever scoreCompanyMatch() would return for that same pair.
 */
export function suggestCompanyMatches(
  transaction: BankTransaction,
  companies: Company[],
  limit = 3,
): CompanyMatchSuggestion[] {
  const scored = companies.map((company) =>
    scoreCompanyMatch(transaction, company),
  );

  return scored
    .filter((s) => s.score > 0.15) // filter out clearly unrelated noise
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
