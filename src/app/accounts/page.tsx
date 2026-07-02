"use client";

import { useAccounts } from "@/modules/ledger/hooks/useAccounts";
import { ChartOfAccountsTable } from "@/modules/ledger/components/ChartOfAccountsTable";

export default function LedgerAccountsPage() {
  const { data: accounts, isLoading } = useAccounts();

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        ანგარიშთა გეგმა
      </h2>
      <ChartOfAccountsTable accounts={accounts ?? []} isLoading={isLoading} />
    </section>
  );
}
