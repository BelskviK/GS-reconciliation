import { redirect } from "next/navigation";

// /ledger moved to / when the ledger Summary became the app's default
// landing page. Kept as a redirect, not deleted outright, so an old
// bookmark or a link from docs/ARCHITECTURE.md's git history still lands
// somewhere real instead of a 404.
export default function LedgerRedirectPage() {
  redirect("/");
}
