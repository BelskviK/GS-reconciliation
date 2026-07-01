-- ================================================
-- Auto-matching RPC function
-- Run this in Supabase SQL Editor AFTER seed_schema.sql and
-- seed_transactions.sql have both been run.
-- ================================================
--
-- WHY THIS LIVES IN THE DATABASE, NOT THE APPLICATION:
--
-- The matching rule itself is a single equality join:
--   bank_transactions.sender_inn = companies.tax_id
--
-- There's no multi-step branching, no external API call, and nothing
-- that benefits from being expressed in TypeScript. It's a set-based
-- operation over rows that already live in the same database — exactly
-- the case where doing the work in SQL beats pulling every row into
-- application memory, looping in JS, and firing one UPDATE per row.
--
-- Wrapping it in a single function also makes the whole operation
-- atomic: it runs as one statement, so there's no scenario where a
-- network blip mid-loop leaves half the transactions matched and half
-- not. A client-side implementation (fetch all transactions + companies,
-- compare in JS, issue N updates) would need to handle that failure mode
-- itself; here it doesn't exist.
--
-- TRADEOFF, for the record: this logic is "invisible" to anyone just
-- reading the Next.js codebase, and harder to unit test in isolation
-- than a plain TS function would be. We accept that because the
-- operation is small, single-purpose, and unlikely to grow much more
-- complex (it would need a real design discussion before, say, adding
-- fuzzy name matching here — that logic stays in the app layer instead,
-- see the "suggested match" bonus feature).
--
-- 'ignored' IS STICKY: a transaction marked 'ignored' represents a human
-- decision ("this isn't a real contract payment, leave it alone") and
-- re-running auto-matching must never silently override that. Only rows
-- currently 'unmatched' are eligible. If someone wants an ignored
-- transaction reconsidered, that's a deliberate un-ignore action in the
-- UI, not a side effect of clicking "Run Matching" again.

CREATE OR REPLACE FUNCTION match_transactions_by_inn()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  matched_count INTEGER;
BEGIN
  UPDATE bank_transactions AS bt
  SET
    matched_company_id = c.id,
    match_method = 'inn_exact',
    match_confidence = 1.00,
    status = 'matched'
  FROM companies AS c
  WHERE bt.sender_inn = c.tax_id
    AND bt.status = 'unmatched'; -- only touch rows nobody has made a decision about

  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RETURN matched_count;
END;
$$;

COMMENT ON FUNCTION match_transactions_by_inn() IS
  'Matches unmatched bank_transactions to companies by exact sender_inn = tax_id equality. Idempotent and non-destructive: only rows with status=unmatched are touched, so already-matched or manually-ignored rows are never overwritten. Returns count of rows updated.';
