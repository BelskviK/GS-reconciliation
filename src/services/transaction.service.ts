import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { BankTransaction, TransactionStatus } from "@/types/domain";

type TransactionRow = Database["public"]["Tables"]["bank_transactions"]["Row"];

type TransactionRowWithCompany = TransactionRow & {
  companies: { name: string } | null;
};

/**
 * Module-level flag set the first time we successfully read a row and
 * observe whether `comment` is present. `select("*")` against Postgres
 * simply omits columns that don't exist — it does not error — so this
 * is populated from real response shape, not guessed. `comment` is a
 * standard column in schema.sql now (not a separate optional migration),
 * so this is mostly a defensive leftover at this point — kept because it's
 * harmless and still correctly guards against a schema.sql that's out of
 * date for any other reason. Components use `hasCommentColumn()` to
 * decide whether to render the comment UI at all.
 */
let commentColumnDetected: boolean | null = null;

export function hasCommentColumn(): boolean {
  return commentColumnDetected ?? false;
}

function toTransaction(
  row: TransactionRowWithCompany & { comment?: string | null },
): BankTransaction {
  if (commentColumnDetected === null) {
    commentColumnDetected = "comment" in row;
  }

  return {
    id: row.id,
    docKey: row.doc_key,
    entryDate: row.entry_date,
    amount: parseFloat(row.amount),
    currency: row.currency,
    senderName: row.sender_name,
    senderInn: row.sender_inn,
    senderAccount: row.sender_account,
    purpose: row.purpose,
    matchedCompanyId: row.matched_company_id,
    matchMethod: row.match_method,
    matchConfidence: row.match_confidence
      ? parseFloat(row.match_confidence)
      : null,
    status: row.status,
    comment: row.comment ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    matchedCompanyName: row.companies?.name ?? null,
  };
}

export interface TransactionFilters {
  monthStart?: string; // "YYYY-MM-DD"
  monthEnd?: string; // "YYYY-MM-DD"
  status?: TransactionStatus | "all";
  search?: string; // matches sender_name or sender_inn
}

export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<BankTransaction[]> {
  const supabase = createClient();

  let query = supabase
    .from("bank_transactions")
    .select("*, companies(name)")
    .order("entry_date", { ascending: false });

  if (filters.monthStart && filters.monthEnd) {
    query = query
      .gte("entry_date", filters.monthStart)
      .lte("entry_date", filters.monthEnd);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      query = query.or(
        `sender_name.ilike.%${term}%,sender_inn.ilike.%${term}%`,
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load transactions: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    toTransaction(row as TransactionRowWithCompany),
  );
}

export async function updateTransactionStatus(
  transactionId: string,
  status: TransactionStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ status })
    .eq("id", transactionId);

  if (error) {
    throw new Error(`Failed to update transaction status: ${error.message}`);
  }
}

export async function manuallyMatchTransaction(
  transactionId: string,
  companyId: string,
  confidence = 1,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({
      matched_company_id: companyId,
      match_method: "manual",
      match_confidence: confidence,
      status: "matched",
    })
    .eq("id", transactionId);

  if (error) {
    throw new Error(`Failed to manually match transaction: ${error.message}`);
  }
}

/**
 * Removes the company assignment from a transaction, resetting it to
 * unmatched. Used when the operator wants to undo a manual (or automatic)
 * match and re-evaluate the transaction from scratch.
 */
export async function unmatchTransaction(
  transactionId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({
      matched_company_id: null,
      match_method: null,
      match_confidence: null,
      status: "unmatched",
    })
    .eq("id", transactionId);

  if (error) {
    throw new Error(`Failed to unmatch transaction: ${error.message}`);
  }
}

/**
 * Updates the free-text comment on a transaction. Only call this when
 * hasCommentColumn() is true — if schema.sql hasn't been run (so the
 * `comment` column doesn't exist yet), this will fail with a Postgres
 * "column does not exist" error.
 */
export async function updateTransactionComment(
  transactionId: string,
  comment: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ comment: comment.trim() || null })
    .eq("id", transactionId);

  if (error) {
    throw new Error(`Failed to update comment: ${error.message}`);
  }
}

/**
 * Thrown by runAutoMatching() specifically when match_transactions_by_inn()
 * doesn't exist in the database yet (schema.sql was never run, or the
 * anon role was never granted EXECUTE on it). Kept as a distinct class so
 * the UI can show an actionable "create the function" message instead of
 * a generic failure.
 */
export class MatchingFunctionMissingError extends Error {
  constructor() {
    super(
      "ბაზაში არ მოიძებნა match_transactions_by_inn() ფუნქცია — გთხოვთ, გაუშვათ schema.sql Supabase SQL Editor-ში და მიანიჭეთ anon როლს EXECUTE უფლება.",
    );
    this.name = "MatchingFunctionMissingError";
  }
}

/**
 * Runs the INN-based auto-matching RPC (see migrations/match_transactions.sql).
 * Returns the number of transactions that were newly matched.
 */
export async function runAutoMatching(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("match_transactions_by_inn");

  if (error) {
    // PostgREST's "function not found in schema cache" error — this is what
    // Supabase returns (code PGRST202) when the RPC was never created, or
    // was created but never granted to `anon`. Postgres itself would also
    // raise 42883 (undefined_function) for the same root cause if this ever
    // ran on a raw connection instead of through PostgREST.
    const isMissingFunction =
      error.code === "PGRST202" ||
      error.code === "42883" ||
      /could not find the function/i.test(error.message) ||
      /function .* does not exist/i.test(error.message);

    if (isMissingFunction) {
      throw new MatchingFunctionMissingError();
    }

    throw new Error(`Auto-matching failed: ${error.message}`);
  }

  return (data as number) ?? 0;
}
