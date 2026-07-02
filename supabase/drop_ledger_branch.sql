-- ================================================
-- Drop the ledger recommendation branch — full rollback
-- ================================================
--
-- Reverts everything added by schema.sql's ledger section (accounts,
-- financial_events, journal_entries, journal_lines, the account_balances
-- view, and both live-posting triggers). Does NOT touch anything from
-- the required assignment: companies, contracts, bank_transactions
-- (including its set_updated_at trigger and comment column), or
-- match_transactions_by_inn() — those are core schema, not part of this
-- branch, and this file never drops them. The reconciliation dashboard
-- on `/` keeps working exactly as before this branch existed.
--
-- Safe to run any time — every DROP is IF EXISTS. Run this in one
-- Supabase SQL Editor tab, top to bottom.

 
DROP TRIGGER IF EXISTS trg_sync_bank_transaction_to_ledger ON bank_transactions;
DROP TRIGGER IF EXISTS trg_sync_contract_to_ledger ON contracts;
DROP FUNCTION IF EXISTS sync_bank_transaction_to_ledger();
DROP FUNCTION IF EXISTS sync_contract_to_ledger();
DROP FUNCTION IF EXISTS post_contract_demand(contracts);
DROP FUNCTION IF EXISTS post_transaction_import(bank_transactions);
DROP FUNCTION IF EXISTS post_transaction_match(bank_transactions);
DROP VIEW IF EXISTS account_balances;
DROP TABLE IF EXISTS journal_lines CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS financial_events CASCADE;
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
 