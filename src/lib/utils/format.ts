/**
 * Shared formatting helpers used across dashboard components.
 * Centralized so currency formatting (locale, decimal places, GEL symbol)
 * stays consistent everywhere a money value is rendered.
 */

export function formatGEL(amount: number): string {
  return new Intl.NumberFormat("ka-GE", {
    style: "currency",
    currency: "GEL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("ka-GE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
