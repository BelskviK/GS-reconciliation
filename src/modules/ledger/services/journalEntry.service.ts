import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { JournalEntry, JournalLine } from "@/modules/ledger/types";

type JournalEntryRow = Database["public"]["Tables"]["journal_entries"]["Row"];
type JournalLineRow = Database["public"]["Tables"]["journal_lines"]["Row"];

type JournalEntryRowWithLines = JournalEntryRow & {
  journal_lines: (JournalLineRow & {
    accounts: { code: string; name: string } | null;
  })[];
};

function toJournalLine(
  row: JournalLineRow & { accounts: { code: string; name: string } | null },
): JournalLine {
  return {
    id: row.id,
    journalEntryId: row.journal_entry_id,
    accountId: row.account_id,
    debit: parseFloat(row.debit),
    credit: parseFloat(row.credit),
    accountCode: row.accounts?.code,
    accountName: row.accounts?.name,
  };
}

function toJournalEntry(row: JournalEntryRowWithLines): JournalEntry {
  return {
    id: row.id,
    financialEventId: row.financial_event_id,
    entryDate: row.entry_date,
    description: row.description,
    createdAt: row.created_at,
    lines: (row.journal_lines ?? []).map(toJournalLine),
  };
}

/**
 * Read-only from the application's point of view — nothing in this
 * module ever INSERTs a journal_entry. Every entry is posted live by one
 * of schema.sql's two triggers: sync_contract_to_ledger() the moment a
 * contract is inserted, or sync_bank_transaction_to_ledger() the moment a
 * bank_transaction is inserted (stage 2) or reaches status='matched'
 * (stage 3). This function only ever reads what's already there. See
 * docs/ARCHITECTURE.md section 4 for the live-posting walkthrough.
 */
export async function getJournalEntries(): Promise<JournalEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*, journal_lines(*, accounts(code, name))")
    .order("entry_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load journal entries: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    toJournalEntry(row as JournalEntryRowWithLines),
  );
}
