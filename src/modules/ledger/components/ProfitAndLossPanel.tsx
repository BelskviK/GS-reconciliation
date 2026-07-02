"use client";

import { cn } from "@/lib/utils/cn";
import { formatGEL } from "@/lib/utils/format";
import type { AccountBalance, AccountType } from "@/modules/ledger/types";

interface ProfitAndLossPanelProps {
  balances: AccountBalance[];
  isLoading?: boolean;
}

interface GroupConfig {
  type: AccountType;
  label: string;
}

const GROUPS: GroupConfig[] = [
  { type: "revenue", label: "შემოსავალი" },
  { type: "expense", label: "ხარჯები" },
];

function GroupCard({
  label,
  accounts,
}: {
  label: string;
  accounts: AccountBalance[];
}) {
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
      <div className="flex items-center justify-between bg-[#faf6dc] px-4 py-3">
        <span className="font-semibold">{label}</span>
        <span className="font-mono text-lg font-semibold">
          {formatGEL(total)}
        </span>
      </div>
      {accounts.length === 0 ? (
        <p className="px-4 py-4 text-xs text-ink-muted">
          ამ ჯგუფში ანგარიშები ან გატარებები ჯერ არ არსებობს
        </p>
      ) : (
        <div className="divide-y divide-hairline">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <span>{a.name}</span>
              <span className="font-mono text-ink-muted">
                {formatGEL(a.balance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
      <div className="h-11 animate-pulse bg-hairline/50" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-full animate-pulse rounded bg-hairline" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-hairline" />
      </div>
    </div>
  );
}

export function ProfitAndLossPanel({
  balances,
  isLoading,
}: ProfitAndLossPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <GroupCardSkeleton />
          </div>
          <div className="flex-1">
            <GroupCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const revenue = balances
    .filter((b) => b.type === "revenue")
    .reduce((sum, a) => sum + a.balance, 0);
  const expense = balances
    .filter((b) => b.type === "expense")
    .reduce((sum, a) => sum + a.balance, 0);
  const netIncome = revenue - expense;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* GROUPS is ordered [revenue, expense] on purpose — this renders
            შემოსავალი on the left and ხარჯები on the right, side by side. */}
        {GROUPS.map((group) => (
          <div key={group.type} className="flex-1">
            <GroupCard
              label={group.label}
              accounts={balances.filter((b) => b.type === group.type)}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl border border-hairline bg-paper px-4 py-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          წმინდა შედეგი
        </span>
        <span
          className={cn(
            "font-mono text-lg font-semibold",
            netIncome >= 0 ? "text-matched" : "text-unmatched",
          )}
        >
          {formatGEL(netIncome)}
        </span>
      </div>
    </div>
  );
}
