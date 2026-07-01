import { cn } from "@/lib/utils/cn";
import type { TransactionStatus } from "@/types/domain";

const STATUS_CONFIG: Record<
  TransactionStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  matched: {
    label: "დამთხვეული",
    dot: "bg-matched",
    bg: "bg-matched-bg",
    text: "text-matched",
  },
  unmatched: {
    label: "შეუსაბამო",
    dot: "bg-unmatched",
    bg: "bg-unmatched-bg",
    text: "text-unmatched",
  },
  ignored: {
    label: "იგნორირებული",
    dot: "bg-ignored",
    bg: "bg-ignored-bg",
    text: "text-ignored",
  },
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.bg,
        config.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

/**
 * Smaller dot-only variant, used in dense contexts (expected-vs-actual rows)
 * where a full badge would be too heavy.
 */
export function StatusDot({
  status,
}: {
  status: "matched" | "unmatched" | "ignored" | "none";
}) {
  const dotClass =
    status === "matched"
      ? "bg-matched"
      : status === "unmatched"
        ? "bg-unmatched"
        : "bg-ignored";

  return <span className={cn("inline-block h-2 w-2 rounded-full", dotClass)} />;
}
