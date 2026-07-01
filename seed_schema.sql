-- ================================================
-- Payment Reconciliation Dashboard — Schema + Seed Data
-- Run this FIRST in Supabase SQL Editor
-- ================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== TABLES ====================

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

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_transactions_sender_inn ON bank_transactions(sender_inn);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_entry_date ON bank_transactions(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_matched_company ON bank_transactions(matched_company_id) WHERE matched_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- ==================== AUTO-UPDATE TRIGGER ====================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== COMPANIES (15) ====================

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

-- ==================== CONTRACTS (18) ====================

INSERT INTO contracts (company_id, monthly_amount, status, start_date, end_date) VALUES
  -- გეოტრანსი: active, 1500/month
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 1500.00, 'active', '2025-03-01', NULL),
  -- მწვანე ლოჯისტიკა: active, 2200/month
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2200.00, 'active', '2025-06-15', NULL),
  -- კავკას ექსპრესი: active, 3100/month
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 3100.00, 'active', '2025-01-10', NULL),
  -- სეიფ ტრანსპორტი: paused, 1800/month (paused May 15 2026)
  ('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 1800.00, 'paused', '2025-04-01', '2026-05-15'),
  -- მთის გზა: active, 900/month
  ('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 900.00, 'active', '2025-09-01', NULL),
  -- აღმოსავლეთ გადაზიდვები: active, 4500/month
  ('f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', 4500.00, 'active', '2025-11-01', NULL),
  -- აღმოსავლეთ გადაზიდვები: ended, 2000/month (old contract)
  ('f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c', 2000.00, 'ended', '2024-06-01', '2025-10-31'),
  -- ფასტ დელივერი: active, 1200/month
  ('a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d', 1200.00, 'active', '2025-08-01', NULL),
  -- ურბან მუვერსი: ended, 1600/month
  ('b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e', 1600.00, 'ended', '2024-12-01', '2026-04-30'),
  -- ტრანს კავკასია: active, 2800/month
  ('c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', 2800.00, 'active', '2025-02-15', NULL),
  -- ეკო ტრანსპორტი: active, 750/month (contract 1)
  ('d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', 750.00, 'active', '2025-05-01', NULL),
  -- ეკო ტრანსპორტი: active, 1100/month (contract 2)
  ('d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', 1100.00, 'active', '2025-07-01', NULL),
  -- სამხრეთ ექსპრესი: active, 1900/month
  ('e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b', 1900.00, 'active', '2025-10-01', NULL),
  -- იბერია ლოჯისტიკს: active, 3500/month
  ('f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c', 3500.00, 'active', '2025-04-15', NULL),
  -- რუსთავი ტრანსი: active, 1100/month
  ('a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d', 1100.00, 'active', '2025-08-01', NULL),
  -- რუსთავი ტრანსი: paused, 800/month (second contract, paused Apr 1 2026)
  ('a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d', 800.00, 'paused', '2025-03-01', '2026-04-01'),
  -- კოლხეთი გრუპი: active, 2600/month
  ('b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e', 2600.00, 'active', '2025-06-01', NULL),
  -- ბათუმი კარგო: active, 4200/month
  ('c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f', 4200.00, 'active', '2025-01-20', NULL);
