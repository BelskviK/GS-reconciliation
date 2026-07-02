"use client";

import { formatGEL } from "@/lib/utils/format";
import type { AccountBalance } from "@/modules/ledger/types";

interface BalanceSheetPanelProps {
  balances: AccountBalance[];
  isLoading?: boolean;
}

/**
 * accounts.type only distinguishes asset/liability/equity/revenue/expense —
 * it has no current-vs-long-term concept, so that split is expressed here,
 * display-only (it doesn't change any posting or balance logic, just which
 * subtotal a row renders under).
 *
 * This is an explicit code allowlist rather than a numeric code-prefix
 * threshold on purpose: schema.sql's chart of accounts doesn't use one
 * consistent short-term-vs-long-term numbering band across the whole
 * chart (1xxx assets sit alongside 3xxx/7xxx liabilities and 8xxx
 * revenue, not a plain 1000/2000/3000/4000 scheme), so a threshold like
 * "code >= 1500" would wrongly catch 1600 წინასწარგადახდილი ხარჯები
 * (prepaid expenses — a current asset) as long-term. There's no
 * fixed-assets account in this chart today, so this set is empty; add a
 * code here if one is introduced later (e.g. ძირითადი საშუალებები).
 */
const LONG_TERM_ASSET_CODES = new Set<string>([]);

function isLongTermAssetCode(code: string): boolean {
  return LONG_TERM_ASSET_CODES.has(code);
}

function sumBalances(accounts: AccountBalance[]): number {
  return accounts.reduce((sum, a) => sum + a.balance, 0);
}

interface SubGroup {
  label: string;
  accounts: AccountBalance[];
}

function AccountRow({ account }: { account: AccountBalance }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-mono text-xs text-ink-muted">
          {account.code}
        </span>
        <span className="truncate">{account.name}</span>
      </span>
      <span className="shrink-0 font-mono text-ink-muted">
        {formatGEL(account.balance)}
      </span>
    </div>
  );
}

function SubGroupSection({ group }: { group: SubGroup }) {
  const total = sumBalances(group.accounts);

  return (
    <div>
      {group.accounts.length > 0 && (
        <div className="divide-y divide-hairline">
          {group.accounts.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between bg-[#faf6dc] px-4 py-2.5 text-sm font-semibold">
        <span>{group.label}</span>
        <span className="font-mono">{formatGEL(total)}</span>
      </div>
    </div>
  );
}

function BalanceSheetColumn({
  title,
  groups,
}: {
  title: string;
  groups: SubGroup[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
      <div className="bg-ink px-4 py-3">
        <span className="font-semibold text-paper">{title}</span>
      </div>
      <div className="divide-y divide-hairline">
        {groups.map((group) => (
          <SubGroupSection key={group.label} group={group} />
        ))}
      </div>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
      <div className="h-11 animate-pulse bg-hairline/50" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-full animate-pulse rounded bg-hairline" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-hairline" />
        <div className="h-4 w-full animate-pulse rounded bg-hairline" />
      </div>
    </div>
  );
}

export function BalanceSheetPanel({
  balances,
  isLoading,
}: BalanceSheetPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColumnSkeleton />
          <ColumnSkeleton />
        </div>
      </div>
    );
  }

  const assetAccounts = balances.filter((b) => b.type === "asset");
  const liabilityAccounts = balances.filter((b) => b.type === "liability");
  const equityAccounts = balances.filter((b) => b.type === "equity");

  const currentAssets = assetAccounts.filter(
    (a) => !isLongTermAssetCode(a.code),
  );
  const longTermAssets = assetAccounts.filter((a) =>
    isLongTermAssetCode(a.code),
  );

  const assetGroups: SubGroup[] = [
    { label: "სულ მიმდინარე აქტივები", accounts: currentAssets },
    { label: "სულ გრძელვადიანი აქტივები", accounts: longTermAssets },
  ];

  const capitalGroups: SubGroup[] = [
    { label: "სულ მიმდინარე ვალდებულებები", accounts: liabilityAccounts },
    { label: "სულ საკუთარი კაპიტალი", accounts: equityAccounts },
  ];

  const totalAssets = sumBalances(assetAccounts);
  const totalCapitalAndLiabilities =
    sumBalances(liabilityAccounts) + sumBalances(equityAccounts);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BalanceSheetColumn title="აქტივები" groups={assetGroups} />
        <BalanceSheetColumn
          title="კაპიტალი და ვალდებულებები"
          groups={capitalGroups}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 overflow-hidden rounded-xl sm:grid-cols-2">
        <div className="flex items-center justify-between bg-ink px-4 py-3">
          <span className="font-semibold uppercase tracking-wide text-paper">
            სულ აქტივები
          </span>
          <span className="font-mono text-lg font-semibold text-paper">
            {formatGEL(totalAssets)}
          </span>
        </div>
        <div className="flex items-center justify-between bg-ink px-4 py-3">
          <span className="font-semibold uppercase tracking-wide text-paper">
            სულ კაპიტალი და ვალდებულებები
          </span>
          <span className="font-mono text-lg font-semibold text-paper">
            {formatGEL(totalCapitalAndLiabilities)}
          </span>
        </div>
      </div>
    </div>
  );
}
