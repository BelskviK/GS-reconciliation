-- ================================================
-- Admin/demo operations — DESTRUCTIVE, NO AUTH CHECK
-- ================================================
--
-- These functions exist to power the "SQL Launcher" demo panel in the
-- dashboard, so reviewers/interviewers can reset and reseed the database
-- repeatedly from the running app instead of re-pasting SQL by hand each
-- time. They are NOT part of the core reconciliation feature set and
-- would never exist in this form in a real production system: there is
-- no authentication gate, and SECURITY DEFINER means they execute with
-- the privileges of the function's owner (the table owner) regardless
-- of which Supabase role calls them. This is a deliberate, accepted
-- tradeoff for a demo/interview tool, not a production pattern.
--
-- Run this file once, in a single query in the Supabase SQL Editor,
-- after seed_schema.sql has been run at least once (so the pgcrypto
-- extension and base objects exist). admin_recreate_schema() is also
-- safe to run standalone — it creates everything seed_schema.sql does,
-- idempotently.

-- ---------- 1. Full reset: drop everything ----------

CREATE OR REPLACE FUNCTION admin_drop_all()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DROP TABLE IF EXISTS bank_transactions CASCADE;
  DROP TABLE IF EXISTS contracts CASCADE;
  DROP TABLE IF EXISTS companies CASCADE;
  DROP FUNCTION IF EXISTS match_transactions_by_inn();
  DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
  RETURN 'All tables and functions dropped.';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_drop_all() TO anon;

-- ---------- 2. Recreate schema + seed companies/contracts ----------
--
-- Mirrors seed_schema.sql. Company/contract INSERTs only run if the
-- companies table is currently empty, so this is safe to call even if
-- admin_drop_all() was not called first.

CREATE OR REPLACE FUNCTION admin_recreate_schema()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS set_updated_at ON bank_transactions;
  CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON bank_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  IF NOT EXISTS (SELECT 1 FROM companies LIMIT 1) THEN
    INSERT INTO companies (id, name, tax_id) VALUES
      ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'შპს გეოტრანსი', '404871234'),
      ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'შპს მწვანე ლოჯისტიკა', '405129876'),
      ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'სს კავკას ექსპრესი', '204567890'),
      ('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'შპს სეიფ ტრანსპორტი', '405234567'),
      ('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'შპს მთის გზა', '404998877'),
      ('f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', 'სს აღმოსავლეთ გადაზიდვები', '204112233'),
      ('a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d', 'შპს ფასტ დელივერი', '405667788'),
      ('b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e', 'შპს ურბან მუვერსი', '404553311'),
      ('c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', 'სს ტრანს კავკასია', '204889900'),
      ('d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', 'შპს ეკო ტრანსპორტი', '405111222'),
      ('e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b', 'შპს სამხრეთ ექსპრესი', '405443322'),
      ('f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c', 'სს იბერია ლოჯისტიკს', '204667788'),
      ('a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d', 'შპს რუსთავი ტრანსი', '404112299'),
      ('b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e', 'შპს კოლხეთი გრუპი', '405889911'),
      ('c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f', 'სს ბათუმი კარგო', '204334455');

    INSERT INTO contracts (company_id, monthly_amount, status, start_date, end_date) VALUES
      ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 1500.00, 'active', '2025-03-01', NULL),
      ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2200.00, 'active', '2025-06-15', NULL),
      ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 3100.00, 'active', '2025-01-10', NULL),
      ('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 1800.00, 'paused', '2025-04-01', '2026-05-15'),
      ('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 900.00, 'active', '2025-09-01', NULL),
      ('f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', 4500.00, 'active', '2025-11-01', NULL),
      ('f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', 2000.00, 'ended', '2024-06-01', '2025-10-31'),
      ('a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d', 1200.00, 'active', '2025-08-01', NULL),
      ('b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e', 1600.00, 'ended', '2024-12-01', '2026-04-30'),
      ('c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', 2800.00, 'active', '2025-02-15', NULL),
      ('d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', 750.00, 'active', '2025-05-01', NULL),
      ('d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', 1100.00, 'active', '2025-07-01', NULL),
      ('e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b', 1900.00, 'active', '2025-10-01', NULL),
      ('f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c', 3500.00, 'active', '2025-04-15', NULL),
      ('a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d', 1100.00, 'active', '2025-08-01', NULL),
      ('a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d', 800.00, 'paused', '2025-03-01', '2026-04-01'),
      ('b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e', 2600.00, 'active', '2025-06-01', NULL),
      ('c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f', 4200.00, 'active', '2025-01-20', NULL);
  END IF;

  RETURN 'Schema recreated, companies and contracts seeded.';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_recreate_schema() TO anon;

-- ---------- 3. Recreate the matching function ----------

CREATE OR REPLACE FUNCTION admin_create_matching_function()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE $func$
    CREATE OR REPLACE FUNCTION match_transactions_by_inn()
    RETURNS INTEGER
    LANGUAGE plpgsql
    AS $body$
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
    $body$;
  $func$;

  EXECUTE 'GRANT EXECUTE ON FUNCTION match_transactions_by_inn() TO anon';

  RETURN 'match_transactions_by_inn() created and granted to anon.';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_matching_function() TO anon;

-- ---------- 4. Seed transactions, one month at a time ----------
--
-- Each function inserts only that month's real seed rows (parsed
-- directly from seed_transactions.sql, not retyped by hand, to
-- guarantee they match exactly). ON CONFLICT (doc_key) DO NOTHING makes
-- re-running a given month's button harmless — it will not create
-- duplicates, but it also will not "top up" once that month's batch
-- already exists. To fully re-seed a month, run admin_drop_all() +
-- admin_recreate_schema() first.

CREATE OR REPLACE FUNCTION admin_seed_transactions_april()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO bank_transactions (doc_key, entry_date, amount, currency, sender_name, sender_inn, sender_account, purpose, status) VALUES
('BOG-2026-04-001', '2026-04-03', 1500.00, 'GEL',
 'შპს გეოტრანსი', '404871234', 'GE29BG0000000524671893',
 'ხელშეკრულებით გათვალისწინებული მომსახურების საფასური, აპრილი 2026', 'unmatched'),
('BOG-2026-04-002', '2026-04-04', 2200.00, 'GEL',
 'შპს მწვანე ლოჯისტიკა', '405129876', 'GE61BG0000000738291054',
 'სატრანსპორტო მომსახურების ანგარიშსწორება 04/2026', 'unmatched'),
('BOG-2026-04-003', '2026-04-05', 3100.00, 'GEL',
 'სს კავკას ექსპრესი', '204567890', 'GE82BG0000000415836729',
 'ხელშეკრულება #KE-2025-041, აპრილის გადახდა', 'unmatched'),
('BOG-2026-04-004', '2026-04-06', 1800.00, 'GEL',
 'შპს სეიფ ტრანსპორტი', '405234567', 'GE26BG0000000598413672',
 'მომსახურების საფასური აპრილი 2026', 'unmatched'),
('BOG-2026-04-005', '2026-04-07', 900.00, 'GEL',
 'შპს მთის გზა', '404998877', 'GE15BG0000000692847153',
 'საგზაო უსაფრთხოების მომსახურება, აპრილი', 'unmatched'),
('BOG-2026-04-006', '2026-04-04', 4500.00, 'GEL',
 'სს აღმოსავლეთ გადაზიდვები', '204112233', 'GE43BG0000000871593246',
 'გადაზიდვის მომსახურების საფასური 04.2026', 'unmatched'),
('BOG-2026-04-007', '2026-04-08', 1200.00, 'GEL',
 'შპს ფასტ დელივერი', '405667788', 'GE77BG0000000953168427',
 'სადისტრიბუციო მომსახურება, აპრილის გადახდა', 'unmatched'),
('BOG-2026-04-008', '2026-04-07', 1600.00, 'GEL',
 'შპს ურბან მუვერსი', '404553311', 'GE19BG0000000726413958',
 'აპრილის გადახდა (ბოლო თვე)', 'unmatched'),
('BOG-2026-04-009', '2026-04-09', 2800.00, 'GEL',
 'სს ტრანს კავკასია', '204889900', 'GE38BG0000000267594831',
 'ხელშ. #TC-2025-018 აპრილის ანგარიშსწორება', 'unmatched'),
('BOG-2026-04-010', '2026-04-10', 750.00, 'GEL',
 'შპს ეკო ტრანსპორტი', '405111222', 'GE54BG0000000184729365',
 'ხელშეკრულება #1 - ეკო ტრანსპორტირება აპრილი', 'unmatched'),
('BOG-2026-04-011', '2026-04-10', 1100.00, 'GEL',
 'შპს ეკო ტრანსპორტი', '405111222', 'GE54BG0000000184729365',
 'ხელშეკრულება #2 - სპეც. ტრანსპორტირება აპრილი', 'unmatched'),
('BOG-2026-04-012', '2026-04-05', 1900.00, 'GEL',
 'შპს სამხრეთ ექსპრესი', '405443322', 'GE31BG0000000462819753',
 'სამხრეთ მიმართულების მომსახურება აპრილი 2026', 'unmatched'),
('BOG-2026-04-013', '2026-04-06', 3500.00, 'GEL',
 'სს იბერია ლოჯისტიკს', '204667788', 'GE72BG0000000815394627',
 'ლოჯისტიკური მომსახურების ყოველთვიური გადახდა აპრილი', 'unmatched'),
('BOG-2026-04-014', '2026-04-08', 1100.00, 'GEL',
 'შპს რუსთავი ტრანსი', '404112299', 'GE48BG0000000639281475',
 'ხელშეკრულება #RT-001 აპრილი', 'unmatched'),
('BOG-2026-04-015', '2026-04-03', 800.00, 'GEL',
 'რუსთავი ტრანსი', '404112299', 'GE48BG0000000639281475',
 'მარტის დარჩენილი დავალიანება ხელშ. #RT-002', 'unmatched'),
('BOG-2026-04-016', '2026-04-07', 2600.00, 'GEL',
 'შპს კოლხეთი გრუპი', '405889911', 'GE63BG0000000527184936',
 'კოლხეთის რეგიონის მომსახურება აპრილი', 'unmatched'),
('BOG-2026-04-017', '2026-04-03', 4200.00, 'GEL',
 'სს ბათუმი კარგო', '204334455', 'GE17BG0000000894236157',
 'ბათუმის მიმართულების ტვირთგადაზიდვა აპრილი', 'unmatched'),
('BOG-2026-04-018', '2026-04-11', 1800.00, 'GEL',
 'შპს დელტა სერვისი', '409999888', 'GE67BG0000000482957136',
 'მომსახურების საფასური აპრილი 2026', 'unmatched'),
('BOG-2026-04-019', '2026-04-15', 950.00, 'GEL',
 'სს მერიდიანი', '203555666', 'GE58BG0000000572618934',
 'საკონტროლო შემოწმების მომსახურება აპრილი', 'unmatched')
  ON CONFLICT (doc_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count || ' transactions inserted for april 2026 (month 04).';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_seed_transactions_april() TO anon;

CREATE OR REPLACE FUNCTION admin_seed_transactions_may()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO bank_transactions (doc_key, entry_date, amount, currency, sender_name, sender_inn, sender_account, purpose, status) VALUES
('BOG-2026-05-001', '2026-05-05', 1500.00, 'GEL',
 'შპს გეოტრანსი', '404871234', 'GE29BG0000000524671893',
 'მომსახურების საფასური, მაისი 2026', 'unmatched'),
('BOG-2026-05-002', '2026-05-06', 2200.00, 'GEL',
 'შპს მწვანე ლოჯისტიკა', '405129876', 'GE61BG0000000738291054',
 'სატრანსპორტო მომსახურება 05/2026', 'unmatched'),
('BOG-2026-05-003', '2026-05-04', 3100.00, 'GEL',
 'კავკას ექსპრესი სს', '204567890', 'GE82BG0000000415836729',
 'ხელშეკრულება #KE-2025-041, მაისის გადახდა', 'unmatched'),
('BOG-2026-05-004', '2026-05-08', 1800.00, 'GEL',
 'შპს სეიფ ტრანსპორტი', '405234567', 'GE26BG0000000598413672',
 'მაისის მომსახურების საფასური (ხელშეკრ. შეჩერებამდე)', 'unmatched'),
('BOG-2026-05-005', '2026-05-07', 900.00, 'GEL',
 'შპს მთის გზა', '404998877', 'GE15BG0000000692847153',
 'საგზაო უსაფრთხოება მაისი', 'unmatched'),
('BOG-2026-05-006', '2026-05-06', 4500.00, 'GEL',
 'სს აღმოსავლეთ გადაზიდვები', '204112233', 'GE43BG0000000871593246',
 'გადაზიდვის მომსახურება 05.2026', 'unmatched'),
('BOG-2026-05-007', '2026-05-09', 1200.00, 'GEL',
 'ფასტ დელივერი', '405667788', 'GE77BG0000000953168427',
 'სადისტრიბუციო მომსახურება მაისი', 'unmatched'),
('BOG-2026-05-008', '2026-05-08', 2800.00, 'GEL',
 'სს ტრანს კავკასია', '204889900', 'GE38BG0000000267594831',
 'ხელშ. #TC-2025-018 მაისი', 'unmatched'),
('BOG-2026-05-009', '2026-05-10', 1850.00, 'GEL',
 'შპს ეკო ტრანსპორტი', '405111222', 'GE54BG0000000184729365',
 'ორივე ხელშეკრულების ერთიანი გადახდა მაისი', 'unmatched'),
('BOG-2026-05-010', '2026-05-05', 1900.00, 'GEL',
 'სამხრეთ ექსპრესი', '405443322', 'GE31BG0000000462819753',
 'მაისის მომსახურება', 'unmatched'),
('BOG-2026-05-011', '2026-05-06', 3500.00, 'GEL',
 'სს იბერია ლოჯისტიკს', '204667788', 'GE72BG0000000815394627',
 'ლოჯისტიკური მომსახურება მაისი', 'unmatched'),
('BOG-2026-05-012', '2026-05-08', 1100.00, 'GEL',
 'შპს რუსთავი ტრანსი', '404112299', 'GE48BG0000000639281475',
 'ხელშეკრულება #RT-001 მაისი', 'unmatched'),
('BOG-2026-05-013', '2026-05-07', 2600.00, 'GEL',
 'კოლხეთი გრუპი', '405889911', 'GE63BG0000000527184936',
 'კოლხეთის მომსახურება მაისი', 'unmatched'),
('BOG-2026-05-014', '2026-05-04', 4200.00, 'GEL',
 'სს ბათუმი კარგო', '204334455', 'GE17BG0000000894236157',
 'ტვირთგადაზიდვა მაისი', 'unmatched'),
('BOG-2026-05-015', '2026-05-12', 3200.00, 'GEL',
 'შპს ბლუ ლაინი', '407333444', 'GE12BG0000000947283615',
 'ლოჯისტიკური მომსახურება მაისი', 'unmatched'),
('BOG-2026-05-016', '2026-05-18', 1450.00, 'GEL',
 'შპს ვექტორი', '406222111', 'GE34BG0000000718293456',
 'სამშენებლო მომსახურება მაისი', 'unmatched'),
('BOG-2026-05-017', '2026-05-22', 4800.00, 'GEL',
 'სს პონტო', '205444333', 'GE91BG0000000364815279',
 'საერთაშორისო გადაზიდვა მაისი', 'unmatched')
  ON CONFLICT (doc_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count || ' transactions inserted for may 2026 (month 05).';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_seed_transactions_may() TO anon;

CREATE OR REPLACE FUNCTION admin_seed_transactions_june()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO bank_transactions (doc_key, entry_date, amount, currency, sender_name, sender_inn, sender_account, purpose, status) VALUES
('BOG-2026-06-001', '2026-06-03', 1500.00, 'GEL',
 'შპს გეოტრანსი', '404871234', 'GE29BG0000000524671893',
 'ხელშეკრულებით გათვალისწინებული მომსახურების საფასური, ივნისი 2026', 'unmatched'),
('BOG-2026-06-002', '2026-06-11', 750.00, 'GEL',
 'გეოტრანსი (ფილიალი)', '404871234', 'GE93BG0000000341876592',
 'ფილიალის დამატებითი გადახდა', 'unmatched'),
('BOG-2026-06-003', '2026-06-20', 3000.00, 'GEL',
 'შპს გეოტრანსი', '404871234', 'GE29BG0000000524671893',
 'ივლისი-აგვისტოს წინასწარი გადახდა', 'unmatched'),
('BOG-2026-06-004', '2026-06-28', 1500.00, 'GEL',
 'გეოტრანსი', '404871234', 'GE29BG0000000524671893',
 'ივლისის ანგარიშსწორება წინასწარ', 'unmatched'),
('BOG-2026-06-005', '2026-06-04', 2200.00, 'GEL',
 'შპს მწვანე ლოჯისტიკა', '405129876', 'GE61BG0000000738291054',
 'სატრანსპორტო მომსახურების ანგარიშსწორება 06/2026', 'unmatched'),
('BOG-2026-06-006', '2026-06-16', 2200.00, 'GEL',
 'შპს მწვანე ლოჯისტიკა', '405129876', 'GE61BG0000000738291054',
 'სატრანსპორტო მომსახურება - დამატებითი ანგარიშსწორება', 'unmatched'),
('BOG-2026-06-007', '2026-06-25', 1100.00, 'GEL',
 'მწვანე ლოჯისტიკა შპს', '405129876', 'GE61BG0000000738291054',
 'ნაწილობრივი წინასწარი გადახდა ივლისი', 'unmatched'),
('BOG-2026-06-008', '2026-06-05', 3100.00, 'GEL',
 'სს კავკას ექსპრესი', '204567890', 'GE82BG0000000415836729',
 'ხელშეკრულება #KE-2025-041, ივნისის გადახდა', 'unmatched'),
('BOG-2026-06-009', '2026-06-17', 3100.00, 'GEL',
 'კავკას ექსპრესი სს', '204567890', 'GE82BG0000000415836729',
 'ხელშეკრულება #KE-2025-041, დამატებითი გადახდა', 'unmatched'),
('BOG-2026-06-010', '2026-06-26', 1550.00, 'GEL',
 'სს კავკას ექსპრესი', '204567890', 'GE82BG0000000415836729',
 'ნაწილობრივი ივლისის წინასწარი', 'unmatched'),
('BOG-2026-06-011', '2026-06-06', 1800.00, 'GEL',
 'შპს სეიფ ტრანსპორტი', '405234567', 'GE26BG0000000598413672',
 'მომსახურების საფასური ივნისი 2026', 'unmatched'),
('BOG-2026-06-012', '2026-06-18', 900.00, 'GEL',
 'სეიფ ტრანსპორტი', '405234567', 'GE26BG0000000598413672',
 'ნაწილობრივი დავალიანების დაფარვა', 'unmatched'),
('BOG-2026-06-013', '2026-06-27', 1800.00, 'GEL',
 'შპს სეიფ ტრანსპორტი', '405234567', 'GE26BG0000000598413672',
 'ივლისის გადახდა წინასწარ', 'unmatched'),
('BOG-2026-06-014', '2026-06-05', 900.00, 'GEL',
 'შპს მთის გზა', '404998877', 'GE15BG0000000692847153',
 'საგზაო უსაფრთხოების მომსახურება, ივნისი', 'unmatched'),
('BOG-2026-06-015', '2026-06-15', 450.00, 'GEL',
 'მთის გზა', '404998877', 'GE15BG0000000692847153',
 'დამატებითი სამუშაოს ანაზღაურება', 'unmatched'),
('BOG-2026-06-016', '2026-06-23', 900.00, 'GEL',
 'შპს მთის გზა', '404998877', 'GE15BG0000000692847153',
 'ივლისის წინასწარი ანგარიშსწორება', 'unmatched'),
('BOG-2026-06-017', '2026-06-06', 4500.00, 'GEL',
 'სს აღმოსავლეთ გადაზიდვები', '204112233', 'GE43BG0000000871593246',
 'გადაზიდვის მომსახურების საფასური 06.2026', 'unmatched'),
('BOG-2026-06-018', '2026-06-19', 2250.00, 'GEL',
 'აღმოსავლეთ გადაზიდვები', '204112233', 'GE43BG0000000871593246',
 'დამატებითი გადაზიდვების ანაზღაურება', 'unmatched'),
('BOG-2026-06-019', '2026-06-26', 4500.00, 'GEL',
 'სს აღმოსავლეთ გადაზიდვები', '204112233', 'GE43BG0000000871593246',
 'ივლისის ანგარიშსწორება წინასწარ', 'unmatched'),
('BOG-2026-06-020', '2026-06-06', 1200.00, 'GEL',
 'შპს ფასტ დელივერი', '405667788', 'GE77BG0000000953168427',
 'სადისტრიბუციო მომსახურება, ყოველთვიური გადახდა', 'unmatched'),
('BOG-2026-06-021', '2026-06-18', 600.00, 'GEL',
 'ფასტ დელივერი', '405667788', 'GE77BG0000000953168427',
 'ნაწილობრივი გადახდა - დარჩენილი გადაიხდება ივლისში', 'unmatched'),
('BOG-2026-06-022', '2026-06-27', 1200.00, 'GEL',
 'შპს ფასტ დელივერი', '405667788', 'GE77BG0000000953168427',
 'ივლისის მომსახურების წინასწარი', 'unmatched'),
('BOG-2026-06-023', '2026-06-07', 1600.00, 'GEL',
 'შპს ურბან მუვერსი', '404553311', 'GE19BG0000000726413958',
 'ივნისის გადახდა (ძველი ხელშეკრულებით)', 'unmatched'),
('BOG-2026-06-024', '2026-06-16', 800.00, 'GEL',
 'ურბან მუვერსი', '404553311', 'GE19BG0000000726413958',
 'დავალიანების ნაწილობრივი დაფარვა', 'unmatched'),
('BOG-2026-06-025', '2026-06-25', 1600.00, 'GEL',
 'შპს ურბან მუვერსი', '404553311', 'GE19BG0000000726413958',
 'ივლისის ანგარიშსწორება', 'unmatched'),
('BOG-2026-06-026', '2026-06-09', 2800.00, 'GEL',
 'სს ტრანს კავკასია', '204889900', 'GE38BG0000000267594831',
 'ხელშ. #TC-2025-018 ივნისის ანგარიშსწორება', 'unmatched'),
('BOG-2026-06-027', '2026-06-19', 1400.00, 'GEL',
 'ტრანს კავკასია', '204889900', 'GE38BG0000000267594831',
 'შუალედური გადახდა', 'unmatched'),
('BOG-2026-06-028', '2026-06-27', 2800.00, 'GEL',
 'სს ტრანს კავკასია', '204889900', 'GE38BG0000000267594831',
 'ივლისის წინასწარი ანგარიშსწორება', 'unmatched'),
('BOG-2026-06-029', '2026-06-10', 750.00, 'GEL',
 'შპს ეკო ტრანსპორტი', '405111222', 'GE54BG0000000184729365',
 'ხელშეკრულება #1 - ეკო ტრანსპორტირება ივნისი', 'unmatched'),
('BOG-2026-06-030', '2026-06-10', 1100.00, 'GEL',
 'შპს ეკო ტრანსპორტი', '405111222', 'GE54BG0000000184729365',
 'ხელშეკრულება #2 - სპეც. ტრანსპორტირება ივნისი', 'unmatched'),
('BOG-2026-06-031', '2026-06-24', 1850.00, 'GEL',
 'ეკო ტრანსპორტი', '405111222', 'GE54BG0000000184729365',
 'ივლისის ორივე ხელშეკრულების ერთიანი გადახდა', 'unmatched'),
('BOG-2026-06-032', '2026-06-04', 1900.00, 'GEL',
 'შპს სამხრეთ ექსპრესი', '405443322', 'GE31BG0000000462819753',
 'სამხრეთ მიმართულების მომსახურება ივნისი 2026', 'unmatched'),
('BOG-2026-06-033', '2026-06-14', 950.00, 'GEL',
 'სამხრეთ ექსპრესი', '405443322', 'GE31BG0000000462819753',
 'დამატებითი რეისის ანაზღაურება', 'unmatched'),
('BOG-2026-06-034', '2026-06-26', 1900.00, 'GEL',
 'შპს სამხრეთ ექსპრესი', '405443322', 'GE31BG0000000462819753',
 'ივლისის ანგარიშსწორება წინასწარ', 'unmatched'),
('BOG-2026-06-035', '2026-06-05', 3500.00, 'GEL',
 'სს იბერია ლოჯისტიკს', '204667788', 'GE72BG0000000815394627',
 'ლოჯისტიკური მომსახურების ყოველთვიური გადახდა', 'unmatched'),
('BOG-2026-06-036', '2026-06-15', 3500.00, 'GEL',
 'იბერია ლოჯისტიკს', '204667788', 'GE72BG0000000815394627',
 'დუბლირებული გადახდა (შეცდომით)', 'unmatched'),
('BOG-2026-06-037', '2026-06-24', 1750.00, 'GEL',
 'სს იბერია ლოჯისტიკს', '204667788', 'GE72BG0000000815394627',
 'ნაწილობრივი ივლისის წინასწარი', 'unmatched'),
('BOG-2026-06-038', '2026-06-06', 1100.00, 'GEL',
 'შპს რუსთავი ტრანსი', '404112299', 'GE48BG0000000639281475',
 'ხელშეკრულება #RT-001 ივნისი', 'unmatched'),
('BOG-2026-06-039', '2026-06-13', 800.00, 'GEL',
 'რუსთავი ტრანსი', '404112299', 'GE48BG0000000639281475',
 'შეჩერებული ხელშ. დავალიანების დაფარვა', 'unmatched'),
('BOG-2026-06-040', '2026-06-25', 1100.00, 'GEL',
 'შპს რუსთავი ტრანსი', '404112299', 'GE48BG0000000639281475',
 'ივლისის წინასწარი #RT-001', 'unmatched'),
('BOG-2026-06-041', '2026-06-07', 2600.00, 'GEL',
 'შპს კოლხეთი გრუპი', '405889911', 'GE63BG0000000527184936',
 'კოლხეთის რეგიონის მომსახურება ივნისი', 'unmatched'),
('BOG-2026-06-042', '2026-06-17', 2600.00, 'GEL',
 'კოლხეთი გრუპი', '405889911', 'GE63BG0000000527184936',
 'დამატებითი ანგარიშსწორება ივნისი', 'unmatched'),
('BOG-2026-06-043', '2026-06-28', 1300.00, 'GEL',
 'შპს კოლხეთი გრუპი', '405889911', 'GE63BG0000000527184936',
 'ივლისის ნაწილობრივი წინასწარი', 'unmatched'),
('BOG-2026-06-044', '2026-06-03', 4200.00, 'GEL',
 'სს ბათუმი კარგო', '204334455', 'GE17BG0000000894236157',
 'ბათუმის მიმართულების ტვირთგადაზიდვა ივნისი', 'unmatched'),
('BOG-2026-06-045', '2026-06-13', 4200.00, 'GEL',
 'ბათუმი კარგო სს', '204334455', 'GE17BG0000000894236157',
 'დამატებითი რეისები ივნისი - სპეც. შეკვეთა', 'unmatched'),
('BOG-2026-06-046', '2026-06-26', 2100.00, 'GEL',
 'სს ბათუმი კარგო', '204334455', 'GE17BG0000000894236157',
 'ივლისის ნაწილობრივი წინასწარი გადახდა', 'unmatched'),
('BOG-2026-06-047', '2026-06-07', 2500.00, 'GEL',
 'შპს დელტა სერვისი', '409999888', 'GE67BG0000000482957136',
 'მომსახურების საფასური ივნისი 2026', 'unmatched'),
('BOG-2026-06-048', '2026-06-10', 1800.00, 'GEL',
 'შპს გლობალ ტრეიდი', '408777666', 'GE41BG0000000315928746',
 'სატრანსპორტო ხელშეკრულება #GT-441', 'unmatched'),
('BOG-2026-06-049', '2026-06-14', 500.00, 'GEL',
 'ი/მ გიორგი კვარაცხელია', '01234567890', 'GE85BG0000000653791248',
 'კონსულტაციის საფასური', 'unmatched'),
('BOG-2026-06-050', '2026-06-19', 3200.00, 'GEL',
 'შპს ბლუ ლაინი', '407333444', 'GE12BG0000000947283615',
 'ლოჯისტიკური მომსახურება ივნისი-ივლისი', 'unmatched'),
('BOG-2026-06-051', '2026-06-24', 950.00, 'GEL',
 'სს მერიდიანი', '203555666', 'GE58BG0000000572618934',
 'საკონტროლო შემოწმების მომსახურება', 'unmatched'),
('BOG-2026-06-052', '2026-06-08', 1450.00, 'GEL',
 'შპს ვექტორი', '406222111', 'GE34BG0000000718293456',
 'სამშენებლო მომსახურების ანგარიშსწორება', 'unmatched'),
('BOG-2026-06-053', '2026-06-22', 4800.00, 'GEL',
 'სს პონტო', '205444333', 'GE91BG0000000364815279',
 'საერთაშორისო გადაზიდვის საფასური ივნისი', 'unmatched')
  ON CONFLICT (doc_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count || ' transactions inserted for june 2026 (month 06).';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_seed_transactions_june() TO anon;

-- ---------- Notes ----------
-- admin_recreate_schema() must be called before the month-seed functions
-- if admin_drop_all() was just called (the bank_transactions table must
-- exist first). admin_create_matching_function() can be called any time
-- after admin_recreate_schema(), independent of whether transactions
-- have been seeded yet.
