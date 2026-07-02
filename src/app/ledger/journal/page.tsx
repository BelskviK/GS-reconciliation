import { redirect } from "next/navigation";

// /ledger/journal moved to /journal — see src/app/ledger/page.tsx for why
// this is a redirect rather than a deletion.
export default function LedgerJournalRedirectPage() {
  redirect("/journal");
}
