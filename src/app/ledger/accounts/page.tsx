import { redirect } from "next/navigation";

// /ledger/accounts moved to /accounts — see src/app/ledger/page.tsx for why
// this is a redirect rather than a deletion.
export default function LedgerAccountsRedirectPage() {
  redirect("/accounts");
}
