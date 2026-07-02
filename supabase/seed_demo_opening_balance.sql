-- ================================================
-- Payment Reconciliation Dashboard — DEMO-ONLY opening-balance adjustment
-- ================================================
--
-- ⚠️  NOT PART OF THE 3-FILE CORE SETUP. NOT FOR PRODUCTION. ⚠️
-- Optional, safe to skip entirely. Run this THIRD — after schema.sql and
-- seed_contracts.sql, but BEFORE seed_transactions.sql. The math below
-- only involves contracts/1410, so it works identically wherever you run
-- it relative to seed_transactions.sql — but running it here means you
-- never see the large, unfixed 462,100 ₾ number on screen at all, even
-- if you check the app between seeding contracts and transactions. See
-- docs/ARCHITECTURE.md's stage-by-step image for the full before/after
-- across all five stages (schema -> contracts -> this file ->
-- transactions -> matching).
--
-- This exists purely to visually sanity-check that /ledger's month-scoped
-- balance calculation (computeAccountBalances(), see its own comment for
-- the exact rule) is doing what it claims: 1410 cumulative-through-month-
-- end, 1210/1490 period-only — and not just re-summing the same
-- 462,100 ₾ every month by accident. Not needed for a real deployment —
-- it's a demo-only convenience, not a correctness fix.
--
-- The problem this demonstrates a fix for: with 18 contracts recurring
-- monthly since 2025 and only 3 months (April–June 2026) of matched
-- payments to offset that backlog, 1410 მოთხოვნები's cumulative-through-
-- April-30 balance is large — 462,100 ₾ — because it's the sum of every
-- month's demand since each contract's own start_date, most of which
-- predates this reconciliation window and has never been paid down.
-- That's real and correct, but it makes it hard to eyeball whether the
-- month tabs are actually doing anything: April, May, June, and July all
-- look like slight variations on the same big number.
--
-- This file inserts ONE manual, hardcoded journal entry — Dr 5900
-- საწყისი ნაშთის კორექტირება (მხოლოდ დემოსთვის) / Cr 1410 for
-- 426,550.00 ₾, dated 2026-04-01 — representing "everything owed as of
-- the start of April was, in reality, already settled before this
-- system existed; only write off what predates April." The math:
--
--   462,100.00 (1410, cumulative through April 30, before this file)
-- -  426,550.00 (this entry)
-- ---------------
--    35,550.00 (1410, cumulative through April 30, after this file)
--
-- 35,550.00 ₾ is not an arbitrary target — it's the sum of every
-- contract's monthly_amount that isContractActiveInMonth() (see
-- src/services/contract.service.ts) would count as active in April 2026
-- specifically, i.e. exactly what April's OWN month of demand should be
-- once nothing before it is outstanding. If /ledger's April tab reads
-- 35,550.00 ₾ after running this file, the cumulative-balance fix is
-- working; if May/June/July's cumulative balance is 35,550 + that
-- month's own additional demand (roughly one more month's worth of
-- active-contract billing each time), that's further confirmation.
--
-- Why an equity account and not a bank_transaction: this number doesn't
-- correspond to a real payment from a real company, so it can't be
-- matched to one company via match_transactions_by_inn() or a manual
-- match (matching is inherently per-company; this is a cross-company
-- aggregate write-off). Posting it as a manual financial_event
-- (source_type = 'manual') against a dedicated, obviously-named plug
-- account keeps it honest and easy to find — it does NOT touch 1210
-- (BOG), 1490 (undefined transactions), or 6000/6110 (revenue), so it
-- can't be mistaken for real cash or real revenue anywhere else in the
-- ledger. This is the one deliberate exception to "every journal entry
-- traces back to a real contracts or bank_transactions row" — everywhere
-- else in this project that claim still holds.
--
-- To remove: delete from journal_entries where financial_event_id in
-- (select id from financial_events where source_type = 'manual' and
-- source_id = '00000000-0000-4000-8000-000000000001'); delete from
-- financial_events where source_type = 'manual' and source_id =
-- '00000000-0000-4000-8000-000000000001'; — cascades to journal_lines.
-- Safe to re-run this file as-is: the fixed source_id makes it a no-op
-- after the first successful run.
-- ================================================

WITH new_event AS (
  INSERT INTO financial_events (source_type, source_id, occurred_at, amount, direction, description)
  VALUES (
    'manual',
    '00000000-0000-4000-8000-000000000001',
    '2026-04-01',
    426550.00,
    'outflow',
    'დემო: საწყისი ნაშთის კორექტირება — 2026-04-01-მდე დაგროვილი მოთხოვნის ჩამოწერა საჩვენებლად (იხ. ამ ფაილის თავსართი)'
  )
  ON CONFLICT (source_type, source_id) DO NOTHING
  RETURNING id
),
new_entry AS (
  INSERT INTO journal_entries (financial_event_id, entry_date, description)
  SELECT id, '2026-04-01', 'დემო: საწყისი ნაშთის კორექტირება (მხოლოდ საჩვენებლად)'
  FROM new_event
  RETURNING id
)
INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
SELECT ne.id, a.id, 426550.00, 0
FROM new_entry ne, accounts a WHERE a.code = '5900'
UNION ALL
SELECT ne.id, a.id, 0, 426550.00
FROM new_entry ne, accounts a WHERE a.code = '1410';
