-- ================================================
-- Payment Reconciliation Dashboard — full schema + functions
-- Run this FIRST, once, in Supabase SQL Editor.
-- ================================================
--
-- Everything the app (both the required reconciliation dashboard and the
-- optional /ledger recommendation branch) needs to run correctly, with
-- zero data. After this file finishes:
--   - `/` loads, shows an empty dashboard, and "მატჩინგის გაშვება" works
--     (it just has nothing to match yet).
--   - `/ledger` loads, shows a full chart of accounts, and every balance
--     reads 0.00 ₾ — accounts exist, nothing has posted to them.
--
-- Then run seed_contracts.sql and seed_transactions.sql (in that order)
-- to load data. Because every table, function, and trigger below already
-- exists BEFORE any row is inserted, the ledger triggers fire live on
-- those seed inserts — there is no separate "backfill" step anywhere in
-- this project. That ordering (schema and functions first, data second)
-- is the whole simplification this file is built around.
--
-- Safe to re-run: every statement is IF NOT EXISTS / CREATE OR REPLACE /
-- ON CONFLICT DO NOTHING.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- 1. Core tables (required by the assignment)
-- ================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  monthly_amount NUMERIC(15, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'ended')),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key TEXT UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GEL',
  sender_name TEXT,
  sender_inn TEXT,
  sender_account TEXT,
  purpose TEXT,
  matched_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  match_method TEXT CHECK (match_method IN ('inn_exact', 'manual')),
  match_confidence NUMERIC(3, 2),
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('matched', 'unmatched', 'ignored')),
  comment TEXT, -- free-text operator note, e.g. "confirmed with the bank, one-off payment"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_sender_inn ON bank_transactions(sender_inn);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_entry_date ON bank_transactions(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_matched_company ON bank_transactions(matched_company_id) WHERE matched_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON bank_transactions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================
-- 2. Auto-matching RPC (behind the "მატჩინგის გაშვება" button)
-- ================================================
--
-- Lives in the database, not the app: the matching rule is a single
-- set-based equality join (bank_transactions.sender_inn = companies.tax_id),
-- so one atomic SQL statement beats fetch-all-compare-in-JS-issue-N-updates.
-- Idempotent — only 'unmatched' rows are touched, so 'ignored' (a human
-- decision) is never silently overwritten and re-running is always safe.

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
    AND bt.status = 'unmatched';

  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RETURN matched_count;
END;
$$;

COMMENT ON FUNCTION match_transactions_by_inn() IS
  'Matches unmatched bank_transactions to companies by exact sender_inn = tax_id equality. Idempotent: only status=unmatched rows are touched. Returns count of rows updated.';

-- ================================================
-- 3. Access (anon key, no auth — required for the app to reach any of this)
-- ================================================

GRANT EXECUTE ON FUNCTION match_transactions_by_inn() TO anon;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;

-- ================================================
-- 4. Ledger tables (optional recommendation branch, see docs/ARCHITECTURE.md)
-- ================================================
--
-- Entirely additive — does not alter companies/contracts/bank_transactions.
-- financial_events is an append-only, source-agnostic "a financial event
-- happened" log; accounts/journal_entries/journal_lines are the classic
-- double-entry ledger layered on top of it.

CREATE TABLE IF NOT EXISTS financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,        -- 'contract' | 'bank_transaction_import' | 'bank_transaction_match' | ...
  source_id UUID NOT NULL,          -- id in whichever domain table owns this event; not FK'd on purpose,
                                     -- since it points at a different table per source_type
  occurred_at DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)   -- one event per source row; re-running an adapter is a no-op
);

CREATE INDEX IF NOT EXISTS idx_financial_events_occurred_at ON financial_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_events_source ON financial_events(source_type, source_id);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_event_id UUID REFERENCES financial_events(id), -- nullable: posting is optional, not automatic
  entry_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One journal_entry per financial_event, max — see post_*() functions below.
ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_financial_event_id_key;
ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_financial_event_id_key UNIQUE (financial_event_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0)) -- a line is a debit or a credit, never both
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

ALTER TABLE financial_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines DISABLE ROW LEVEL SECURITY;

-- ---------- Chart of accounts ----------
--
-- 1210/1410/1490/6000/6110 are the five accounts the triggers below
-- actually touch. The rest exist to make /ledger/accounts read like a
-- real small-business chart of accounts — nothing in this branch posts
-- to them, they sit at 0.00 ₾ until a real expense/payroll/invoicing
-- module exists to post to them.
--
-- Numbering intentionally departs from a plain 1000=asset/2000=liability/
-- 3000=equity/4000=revenue/5000-6000=expense scheme in favor of one closer
-- to a real Georgian chart-of-accounts convention: 1xxx assets, 3xxx/7xxx
-- liabilities (short-term payables split from accrued-expense payables),
-- 5xxx equity, 6xxx/8xxx revenue (operating vs. non-operating), 7xxx
-- expenses. There's no fixed-assets account in this branch, so every
-- asset here is current/liquid — see BalanceSheetPanel.tsx's comment for
-- how the ledger UI's current-vs-long-term split handles that.
--
-- 5900 is a demo-only plug/adjustment account — see the big warning on
-- seed_demo_opening_balance.sql (optional, NOT part of the 3-file core
-- setup, NOT for production). Every other account here only ever gets
-- posted to by a real contracts/bank_transactions row; 5900 is the one
-- deliberate exception, and it's clearly labeled as such in its own name.
INSERT INTO accounts (code, name, type, normal_balance) VALUES
  ('1210', 'საბანკო ანგარიშსწორება (BOG)', 'asset', 'debit'),
  ('1410', 'მოთხოვნები (მყიდველთა დავალიანება)', 'asset', 'debit'),
  ('1490', 'დაუდგენელი ტრანზაქციები', 'asset', 'debit'),
  ('1600', 'წინასწარგადახდილი ხარჯები', 'asset', 'debit'),
  ('3320', 'გადასახდელი გადასახადები', 'liability', 'credit'),
  ('5310', 'გაუნაწილებელი მოგება', 'equity', 'credit'),
  ('5900', 'საწყისი ნაშთის კორექტირება (მხოლოდ დემოსთვის)', 'equity', 'credit'),
  ('6000', 'ხელშეკრულების შემოსავალი', 'revenue', 'credit'),
  ('6110', 'არა იდენტიფიცირებელი შემოსავალი', 'revenue', 'credit'),
  ('7410', 'დარიცხული ხელფასები', 'liability', 'credit'),
  ('7415', 'ხელფასების ხარჯი', 'expense', 'debit'),
  ('7420', 'ქირის ხარჯი', 'expense', 'debit'),
  ('7425', 'საოფისე ხარჯები', 'expense', 'debit'),
  ('7430', 'კომუნალური გადასახდელები', 'expense', 'debit'),
  ('7490', 'სხვა საოპერაციო ხარჯები', 'expense', 'debit'),
  ('7491', 'საბანკო მომსახურების ხარჯი', 'expense', 'debit'),
  ('8190', 'საპროცენტო შემოსავალი', 'revenue', 'credit')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  normal_balance = EXCLUDED.normal_balance;
-- DO UPDATE, not DO NOTHING: re-running schema.sql after editing a name,
-- type, or normal_balance above (e.g. renaming 6110) syncs the change into
-- an already-seeded database without needing to truncate/reseed anything —
-- accounts have no foreign key from financial_events/journal_lines by
-- code, only by id, so updating these columns in place never orphans a
-- posted entry.

COMMENT ON COLUMN accounts.code IS
  '1210/1410/1490 are the three accounts the live-posting triggers touch on every contract/import/match, alongside revenue accounts 6000/6110. 6110 is the suspense revenue booked at import and reversed at match — it never represents real, recognized revenue; 6000 does that, once per active month, when a contract exists.';

-- ---------- account_balances view ----------

CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id,
  a.code,
  a.name,
  a.type,
  a.normal_balance,
  a.is_active,
  CASE
    WHEN a.normal_balance = 'debit'
      THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
    ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
  END AS balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type, a.normal_balance, a.is_active;

GRANT SELECT ON account_balances TO anon;

COMMENT ON VIEW account_balances IS
  'Read-only, per-account running balance signed according to that account''s normal_balance. Powers the /ledger summary page.';

-- ================================================
-- 5. Ledger triggers (live posting — see docs/ARCHITECTURE.md section 4)
-- ================================================
--
-- Three stages, three postings, each reacting to a row appearing or
-- changing in a table the assignment already required. No application
-- code calls any of this directly — that's the point (see the "adapter"
-- discussion in docs/ARCHITECTURE.md).
--
--   Stage 1 — a contract is created          -> Dr 1410 / Cr 6000
--   Stage 2 — a bank transaction is imported -> Dr 1490 / Cr 6110
--   Stage 3 — that transaction is matched    -> Dr 1210 / Cr 1490
--                                                Dr 6110 / Cr 1410
--
-- Invariant this guarantees at every point in time:
--   sum(bank_transactions.amount) = balance(1210) + balance(1490)
--         "Imported"                  "Matched"       "Undefined"

-- ---------- Stage 1: contracts create demand ----------

CREATE OR REPLACE FUNCTION post_contract_demand(p_contract contracts)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
  v_entry_id UUID;
  v_receivable_account UUID;
  v_revenue_account UUID;
  v_company_name TEXT;
  v_month_start DATE;
  v_last_month DATE;
  v_entry_date DATE;
  v_source_id UUID;
BEGIN
  SELECT id INTO v_receivable_account FROM accounts WHERE code = '1410';
  SELECT id INTO v_revenue_account FROM accounts WHERE code = '6000';
  IF v_receivable_account IS NULL OR v_revenue_account IS NULL THEN
    RETURN; -- ledger scaffold not installed; reconciliation itself is unaffected
  END IF;

  SELECT name INTO v_company_name FROM companies WHERE id = p_contract.company_id;

  -- A contract represents recurring monthly demand, not a one-time lump
  -- sum: post one Dr 1410 / Cr 6000 entry of monthly_amount for every
  -- calendar month the contract was active, from its start_date's month
  -- through end_date's month — or through the current month, for the
  -- common case of end_date IS NULL (an ongoing contract). This is what
  -- makes 1410 show up correctly no matter which month is selected on
  -- /ledger, instead of only the single month the contract began.
  --
  -- Deliberately NOT gated on status = 'active': this mirrors
  -- isContractActiveInMonth() (src/services/contract.service.ts), which
  -- the reconciliation dashboard's own expected-vs-actual already uses
  -- and which intentionally treats 'paused'/'ended' the same as
  -- 'active' for any month up to end_date — both statuses just mean
  -- "this end_date is when the company stopped owing," so a contract
  -- that was active for real months before pausing/ending still
  -- generated real, collectible demand for those months. Only
  -- start_date/end_date bound which months post; status never
  -- suppresses a month that already happened.
  v_month_start := date_trunc('month', p_contract.start_date)::date;
  v_last_month := date_trunc('month', LEAST(COALESCE(p_contract.end_date, CURRENT_DATE), CURRENT_DATE))::date;

  WHILE v_month_start <= v_last_month LOOP
    -- Each contract-month needs its own financial_events row, but the
    -- table's uniqueness is (source_type, source_id) — a single UUID.
    -- Derive a deterministic UUID from contract id + month so re-running
    -- this function for the same contract-month is still a no-op
    -- (ON CONFLICT DO NOTHING below), while each distinct month still
    -- gets its own row.
    v_source_id := (
      regexp_replace(
        md5(p_contract.id::text || ':' || to_char(v_month_start, 'YYYY-MM')),
        '^(.{8})(.{4})(.{4})(.{4})(.{12})$',
        '\1-\2-\3-\4-\5'
      )
    )::uuid;

    v_entry_date := GREATEST(v_month_start, p_contract.start_date);

    INSERT INTO financial_events (source_type, source_id, occurred_at, amount, direction, description)
    VALUES (
      'contract',
      v_source_id,
      v_entry_date,
      p_contract.monthly_amount,
      'inflow',
      'ხელშეკრულების მოთხოვნა — ' || COALESCE(v_company_name, 'უცნობი კომპანია') || ' (' || to_char(v_month_start, 'YYYY-MM') || ')'
    )
    ON CONFLICT (source_type, source_id) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NULL THEN
      SELECT id INTO v_event_id FROM financial_events
      WHERE source_type = 'contract' AND source_id = v_source_id;
    END IF;

    IF v_event_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM journal_entries WHERE financial_event_id = v_event_id
    ) THEN
      INSERT INTO journal_entries (financial_event_id, entry_date, description)
      VALUES (
        v_event_id,
        v_entry_date,
        'ხელშეკრულების მოთხოვნა — ' || COALESCE(v_company_name, 'უცნობი კომპანია') || ' (' || to_char(v_month_start, 'YYYY-MM') || ')'
      )
      RETURNING id INTO v_entry_id;

      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
        (v_entry_id, v_receivable_account, p_contract.monthly_amount, 0),
        (v_entry_id, v_revenue_account, 0, p_contract.monthly_amount);
    END IF;

    v_month_start := (v_month_start + INTERVAL '1 month')::date;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION post_contract_demand(contracts) IS
  'Stage 1: posts one Dr 1410 / Cr 6000 entry per calendar month a contract was active (start_date''s month through end_date''s month, or through the current month if end_date is NULL), each for that contract''s monthly_amount. Ignores status (mirrors isContractActiveInMonth() in contract.service.ts) so paused/ended contracts still post for the months before their end_date. Idempotent per contract-month.';

CREATE OR REPLACE FUNCTION sync_contract_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM post_contract_demand(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contract_to_ledger ON contracts;
CREATE TRIGGER trg_sync_contract_to_ledger
  AFTER INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION sync_contract_to_ledger();

COMMENT ON TRIGGER trg_sync_contract_to_ledger ON contracts IS
  'Adapter: a new contract automatically creates its own demand in the ledger. Fires live on seed_contracts.sql''s inserts, since this trigger already exists by the time that file runs.';

-- ---------- Stage 2: importing a transaction posts to suspense ----------

CREATE OR REPLACE FUNCTION post_transaction_import(p_transaction bank_transactions)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
  v_entry_id UUID;
  v_undefined_account UUID;
  v_suspense_revenue_account UUID;
BEGIN
  SELECT id INTO v_undefined_account FROM accounts WHERE code = '1490';
  SELECT id INTO v_suspense_revenue_account FROM accounts WHERE code = '6110';
  IF v_undefined_account IS NULL OR v_suspense_revenue_account IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO financial_events (source_type, source_id, occurred_at, amount, direction, description)
  VALUES (
    'bank_transaction_import',
    p_transaction.id,
    p_transaction.entry_date,
    p_transaction.amount,
    'inflow',
    'შემოსული თანხა, ჯერ დაუდგენელი — ' || COALESCE(p_transaction.sender_name, 'უცნობი გამგზავნი')
  )
  ON CONFLICT (source_type, source_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM financial_events
    WHERE source_type = 'bank_transaction_import' AND source_id = p_transaction.id;
  END IF;

  IF v_event_id IS NULL OR EXISTS (
    SELECT 1 FROM journal_entries WHERE financial_event_id = v_event_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO journal_entries (financial_event_id, entry_date, description)
  VALUES (v_event_id, p_transaction.entry_date, 'შემოსავალი, დაუდგენელი — ' || COALESCE(p_transaction.sender_name, 'უცნობი გამგზავნი'))
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_entry_id, v_undefined_account, p_transaction.amount, 0),
    (v_entry_id, v_suspense_revenue_account, 0, p_transaction.amount);
END;
$$;

COMMENT ON FUNCTION post_transaction_import(bank_transactions) IS
  'Stage 2: posts Dr 1490 / Cr 6110 for the full amount of one imported bank transaction, regardless of match status ("undefined earnings" = every imported transaction, matched, unmatched, or ignored, until stage 3 moves its amount out).';

-- ---------- Stage 3: matching reclassifies cash and settles the receivable ----------

CREATE OR REPLACE FUNCTION post_transaction_match(p_transaction bank_transactions)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
  v_entry_id UUID;
  v_bank_account UUID;
  v_undefined_account UUID;
  v_suspense_revenue_account UUID;
  v_receivable_account UUID;
BEGIN
  IF p_transaction.status <> 'matched' THEN
    RETURN;
  END IF;

  SELECT id INTO v_bank_account FROM accounts WHERE code = '1210';
  SELECT id INTO v_undefined_account FROM accounts WHERE code = '1490';
  SELECT id INTO v_suspense_revenue_account FROM accounts WHERE code = '6110';
  SELECT id INTO v_receivable_account FROM accounts WHERE code = '1410';
  IF v_bank_account IS NULL OR v_undefined_account IS NULL
     OR v_suspense_revenue_account IS NULL OR v_receivable_account IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO financial_events (source_type, source_id, occurred_at, amount, direction, description)
  VALUES (
    'bank_transaction_match',
    p_transaction.id,
    p_transaction.entry_date,
    p_transaction.amount,
    'inflow',
    (CASE WHEN p_transaction.match_method = 'manual' THEN 'ხელით მატჩინგი' ELSE 'ავტო-მატჩინგი (ს/კ)' END)
      || ' — ' || COALESCE(p_transaction.sender_name, 'უცნობი გამგზავნი')
  )
  ON CONFLICT (source_type, source_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM financial_events
    WHERE source_type = 'bank_transaction_match' AND source_id = p_transaction.id;
  END IF;

  IF v_event_id IS NULL OR EXISTS (
    SELECT 1 FROM journal_entries WHERE financial_event_id = v_event_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO journal_entries (financial_event_id, entry_date, description)
  VALUES (v_event_id, p_transaction.entry_date, 'მოთხოვნის დაფარვა — ' || COALESCE(p_transaction.sender_name, 'უცნობი გამგზავნი'))
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_entry_id, v_bank_account, p_transaction.amount, 0),
    (v_entry_id, v_undefined_account, 0, p_transaction.amount),
    (v_entry_id, v_suspense_revenue_account, p_transaction.amount, 0),
    (v_entry_id, v_receivable_account, 0, p_transaction.amount);
END;
$$;

COMMENT ON FUNCTION post_transaction_match(bank_transactions) IS
  'Stage 3: for a matched transaction, posts Dr 1210/Cr 1490 (reclassify identified cash out of suspense) and Dr 6110/Cr 1410 (settle the receivable against the suspense revenue from stage 2, not against 6000) in one entry. Idempotent.';

CREATE OR REPLACE FUNCTION sync_bank_transaction_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_left_matched BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM post_transaction_import(NEW); -- stage 2: fires once, independent of status
  END IF;

  v_left_matched := TG_OP = 'UPDATE'
    AND OLD.status = 'matched' AND NEW.status IS DISTINCT FROM 'matched';

  IF NEW.status = 'matched' THEN
    PERFORM post_transaction_match(NEW); -- stage 3: idempotent, covers insert-already-matched too
  ELSIF v_left_matched THEN
    DELETE FROM journal_entries
    WHERE financial_event_id IN (
      SELECT id FROM financial_events
      WHERE source_type = 'bank_transaction_match' AND source_id = NEW.id
    ); -- cascades to journal_lines
    DELETE FROM financial_events
    WHERE source_type = 'bank_transaction_match' AND source_id = NEW.id;
    -- The stage-2 import posting is untouched: unmatching moves the
    -- money back into 1490, it doesn't un-import the transaction.
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_bank_transaction_to_ledger() IS
  'Adapter: reacts to bank_transactions INSERT (stage 2) and to status reaching/leaving matched (stage 3). Fires on the same INSERT/UPDATE the app already issues via seed_transactions.sql, match_transactions_by_inn(), or a manual match.';

DROP TRIGGER IF EXISTS trg_sync_bank_transaction_to_ledger ON bank_transactions;
CREATE TRIGGER trg_sync_bank_transaction_to_ledger
  AFTER INSERT OR UPDATE ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_bank_transaction_to_ledger();
