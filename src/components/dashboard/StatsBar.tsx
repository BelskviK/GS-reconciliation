import { formatGEL } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { BankTransaction } from "@/types/domain";

interface StatsBarProps {
  transactions: BankTransaction[];
  isLoading?: boolean;
}

interface StatCardProps {
  label: string;
  count: number;
  amount: number;
  accentClass?: string;
}

function StatCard({ label, count, amount, accentClass }: StatCardProps) {
  return (
    <div className="flex-1 rounded-xl border border-hairline bg-paper-raised p-4 sm:p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className={cn("mt-2 font-mono text-2xl font-semibold", accentClass)}>
        {count}
      </div>
      <div className="mt-1 font-mono text-sm text-ink-muted">
        {formatGEL(amount)}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="flex-1 rounded-xl border border-hairline bg-paper-raised p-4 sm:p-5">
      <div className="h-3 w-20 animate-pulse rounded bg-hairline" />
      <div className="mt-3 h-7 w-12 animate-pulse rounded bg-hairline" />
      <div className="mt-2 h-4 w-24 animate-pulse rounded bg-hairline" />
    </div>
  );
}

export function StatsBar({ transactions, isLoading }: StatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const total = transactions.length;
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const matched = transactions.filter((t) => t.status === "matched");
  const matchedAmount = matched.reduce((sum, t) => sum + t.amount, 0);

  const unmatched = transactions.filter((t) => t.status === "unmatched");
  const unmatchedAmount = unmatched.reduce((sum, t) => sum + t.amount, 0);

  const matchRate = total > 0 ? Math.round((matched.length / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <StatCard label="სულ ტრანზაქცია" count={total} amount={totalAmount} />
      <StatCard
        label="დამთხვეული"
        count={matched.length}
        amount={matchedAmount}
        accentClass="text-matched"
      />
      <StatCard
        label="შეუსაბამო"
        count={unmatched.length}
        amount={unmatchedAmount}
        accentClass="text-unmatched"
      />
      <div className="flex-1 rounded-xl border border-hairline bg-paper-raised p-4 sm:p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Match Rate
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold">
          {matchRate}%
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full rounded-full bg-matched transition-all"
            style={{ width: `${matchRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
