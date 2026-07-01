/**
 * Minimal CSV export — no library needed for a handful of columns.
 * Escapes values containing commas, quotes, or newlines per RFC 4180.
 */
function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvValue).join(","),
  );
  // Leading BOM so Excel (common in Georgian business contexts) opens
  // UTF-8 Georgian text correctly instead of mangling it.
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
