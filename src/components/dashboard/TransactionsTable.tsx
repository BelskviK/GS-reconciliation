"use client";

import { useState, useMemo } from "react";
import {
  ArrowUpDown,
  Check,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatGEL, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusMultiSelect } from "@/components/dashboard/StatusMultiSelect";
import { CompanyMatchSelect } from "@/components/dashboard/CompanyMatchSelect";
import { MatchScoreDot } from "@/components/dashboard/MatchScoreDot";
import { hasCommentColumn } from "@/services/transaction.service";
import type {
  BankTransaction,
  Company,
  TransactionStatus,
} from "@/types/domain";
import type { TableSort } from "@/schemas/transactionFilters";

const ROWS_PER_PAGE = 15;

interface TransactionsTableProps {
  transactions: BankTransaction[];
  companies: Company[];
  isLoading?: boolean;
  statusFilter: TransactionStatus[];
  onStatusFilterChange: (statuses: TransactionStatus[]) => void;
  onIgnore?: (transactionId: string) => void;
  onUnignore?: (transactionId: string) => void;
  onManualMatch?: (transactionId: string, companyId: string) => void;
  onUnmatch?: (transactionId: string) => void;
  onCommentSave?: (transactionId: string, comment: string) => void;
  pendingActionId?: string | null;
}

function SortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: TableSort["field"];
  sort: TableSort;
  onSort: (field: TableSort["field"]) => void;
}) {
  const isActive = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wide transition-colors",
        isActive ? "text-ink" : "text-ink-muted hover:text-ink",
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-hairline">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="h-4 w-20 animate-pulse rounded bg-hairline" />
          <div className="h-4 w-32 flex-1 animate-pulse rounded bg-hairline" />
          <div className="h-4 w-20 animate-pulse rounded bg-hairline" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-hairline" />
        </div>
      ))}
    </div>
  );
}

function CommentCell({
  transaction,
  onSave,
}: {
  transaction: BankTransaction;
  onSave?: (transactionId: string, comment: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(transaction.comment ?? "");

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave?.(transaction.id, draft);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(transaction.comment ?? "");
              setEditing(false);
            }
          }}
          onBlur={() => {
            onSave?.(transaction.id, draft);
            setEditing(false);
          }}
          placeholder="დაამატეთ კომენტარი..."
          className="w-40 rounded border border-hairline bg-paper-raised px-2 py-1 text-xs outline-none focus:border-ink"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex max-w-40 items-center gap-1 truncate text-left text-xs text-ink-muted hover:text-ink"
      title={transaction.comment ?? "კომენტარის დამატება"}
    >
      {transaction.comment ? (
        <span className="truncate">{transaction.comment}</span>
      ) : (
        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 opacity-50" />
      )}
    </button>
  );
}

export function TransactionsTable({
  transactions,
  companies,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onIgnore,
  onUnignore,
  onManualMatch,
  onUnmatch,
  onCommentSave,
  pendingActionId,
}: TransactionsTableProps) {
  const [sort, setSort] = useState<TableSort>({
    field: "entry_date",
    direction: "desc",
  });
  const [expanded, setExpanded] = useState(false);

  const showCommentColumn = hasCommentColumn();

  function handleSort(field: TableSort["field"]) {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" },
    );
  }

  const sorted = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      const dir = sort.direction === "asc" ? 1 : -1;
      if (sort.field === "amount") return (a.amount - b.amount) * dir;
      return a.entryDate.localeCompare(b.entryDate) * dir;
    });
    return copy;
  }, [transactions, sort]);

  const visible = expanded ? sorted : sorted.slice(0, ROWS_PER_PAGE);
  const hasMore = sorted.length > ROWS_PER_PAGE;
  const totalAmount = sorted.reduce((sum, t) => sum + t.amount, 0);
  const extraCols = showCommentColumn ? 1 : 0;

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
        <TableSkeleton />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-paper-raised p-12 text-center">
        <p className="text-sm text-ink-muted">
          ამ ფილტრით ტრანზაქციები არ მოიძებნა
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-paper-raised">
      <div className="overflow-x-auto">
        {/* table-fixed + an explicit <colgroup> pins every column to a
            fixed width up front, instead of letting the browser size
            columns off each cell's content (the default `auto` layout).
            With `auto`, a long sender name or a newly-added comment can
            shove every other column sideways as rows re-render — with
            `fixed`, only the sender column (the one column left without
            an explicit width below) absorbs the remaining space, and
            everything else — date, ს/კ, თანხა, სტატუსი, matched company,
            action — stays exactly as wide no matter what the row data
            looks like. Cells that could overflow their fixed width
            (sender, ს/კ, matched company, comment) truncate with an
            ellipsis instead of growing the column. */}
        <table className="w-full min-w-270 table-fixed text-sm">
          <colgroup>
            <col className="w-36" />
            <col className="min-w-40" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-56" />
            {showCommentColumn && <col className="w-40" />}
            <col className="w-40" />
          </colgroup>
          <thead>
            <tr className="border-b border-hairline bg-paper">
              <th className="px-4 py-3 text-left">
                <SortHeader
                  label="თარიღი"
                  field="entry_date"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                გამგზავნი
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                ს/კ
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader
                  label="თანხა"
                  field="amount"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <StatusMultiSelect
                  selected={statusFilter}
                  onChange={onStatusFilterChange}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                შესაბამისი კომპანია
              </th>
              {showCommentColumn && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                  კომენტარი
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                მოქმედება
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {visible.map((tx) => {
              const isPending = pendingActionId === tx.id;
              return (
                <tr key={tx.id} className="hover:bg-paper/60">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-ink-muted">
                    {formatDate(tx.entryDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="min-w-0 truncate"
                        title={tx.senderName ?? undefined}
                      >
                        {tx.senderName ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td
                    className="truncate px-4 py-3 font-mono text-ink-muted"
                    title={tx.senderInn ?? undefined}
                  >
                    {tx.senderInn ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-medium">
                    {formatGEL(tx.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {" "}
                      <MatchScoreDot transaction={tx} companies={companies} />
                      {onManualMatch ? (
                        <CompanyMatchSelect
                          transaction={tx}
                          companies={companies}
                          onSelect={(companyId) =>
                            onManualMatch(tx.id, companyId)
                          }
                          onRemove={
                            tx.matchedCompanyId && onUnmatch
                              ? () => onUnmatch(tx.id)
                              : undefined
                          }
                          disabled={isPending}
                        />
                      ) : (
                        <span
                          className="min-w-0 truncate px-2 text-ink-muted"
                          title={tx.matchedCompanyName ?? undefined}
                        >
                          {tx.matchedCompanyName ?? "—"}
                        </span>
                      )}
                    </div>
                  </td>
                  {showCommentColumn && (
                    <td className="px-4 py-3">
                      <CommentCell transaction={tx} onSave={onCommentSave} />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {tx.status === "unmatched" && onIgnore && (
                      <button
                        onClick={() => onIgnore(tx.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-xs font-medium text-ink-muted hover:border-ink hover:text-ink disabled:opacity-50"
                      >
                        <EyeOff className="h-3 w-3" />
                        იგნორირება
                      </button>
                    )}
                    {tx.status === "ignored" && onUnignore && (
                      <button
                        onClick={() => onUnignore(tx.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-xs font-medium text-ink-muted hover:border-ink hover:text-ink disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        დაბრუნება
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-hairline bg-paper">
              <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                სულ ({sorted.length})
              </td>
              <td colSpan={3 + extraCols} />
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">
                {formatGEL(totalAmount)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-hairline py-2.5 text-xs font-medium text-ink-muted hover:bg-paper hover:text-ink"
        >
          {expanded ? (
            <>
              ნაკლების ჩვენება <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              კიდევ {sorted.length - ROWS_PER_PAGE} ტრანზაქციის ჩვენება{" "}
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
