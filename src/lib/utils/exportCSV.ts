import type { Company, Contract, BankTransaction } from "@/types/domain";
import type { MonthRange } from "@/lib/utils/month";
import { getExpectedAmountForCompanyInMonth } from "@/services/contract.service";

function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportExpectedVsActualCSV(
  companies: Company[],
  contracts: Contract[],
  transactions: BankTransaction[],
  monthRange: MonthRange,
  monthLabel: string,
): void {
  const matchedByCompany = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.status === "matched" && tx.matchedCompanyId) {
      matchedByCompany.set(
        tx.matchedCompanyId,
        (matchedByCompany.get(tx.matchedCompanyId) ?? 0) + tx.amount,
      );
    }
  }

  const rows = companies
    .map((company) => {
      const expected = getExpectedAmountForCompanyInMonth(
        contracts,
        company.id,
        monthRange.monthStart,
        monthRange.monthEnd,
      );
      const actual = matchedByCompany.get(company.id) ?? 0;
      return { company, expected, actual, difference: actual - expected };
    })
    .filter((r) => r.expected > 0 || r.actual > 0)
    .sort((a, b) => b.expected - a.expected);

  const headers = ["კომპანია", "ს/კ", "მოსალოდნელი (₾)", "ფაქტობრივი (₾)", "სხვაობა (₾)", "სტატუსი"];

  const lines = [
    `# გადახდების შედარება — ${monthLabel}`,
    "",
    headers.map(escapeCSV).join(","),
    ...rows.map((r) => {
      const status =
        r.actual >= r.expected && r.expected > 0
          ? "გადახდილია"
          : r.expected > 0
            ? "ნაკლები გადახდა"
            : "მოსალოდნელი არ არის";
      return [
        r.company.name,
        r.company.taxId,
        r.expected.toFixed(2),
        r.actual.toFixed(2),
        r.difference.toFixed(2),
        status,
      ]
        .map(escapeCSV)
        .join(",");
    }),
    "",
    `სულ,,${rows.reduce((s, r) => s + r.expected, 0).toFixed(2)},${rows.reduce((s, r) => s + r.actual, 0).toFixed(2)},${rows.reduce((s, r) => s + r.difference, 0).toFixed(2)},`,
  ];

  const BOM = "\uFEFF"; // UTF-8 BOM so Excel opens Georgian text correctly
  const blob = new Blob([BOM + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reconciliation-${monthRange.monthStart.slice(0, 7)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
