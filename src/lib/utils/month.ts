import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export type MonthKey = string; // "YYYY-MM"

export interface MonthRange {
  monthStart: string; // "YYYY-MM-DD"
  monthEnd: string;   // "YYYY-MM-DD"
}

export interface MonthOption {
  key: MonthKey;
  label: string;
}

const GEORGIAN_MONTHS: Record<number, string> = {
  1: "იანვარი", 2: "თებერვალი", 3: "მარტი", 4: "აპრილი",
  5: "მაისი", 6: "ივნისი", 7: "ივლისი", 8: "აგვისტო",
  9: "სექტემბერი", 10: "ოქტომბერი", 11: "ნოემბერი", 12: "დეკემბერი",
};

export function getMonthRange(monthKey: MonthKey): MonthRange {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return {
    monthStart: format(startOfMonth(date), "yyyy-MM-dd"),
    monthEnd: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function getMonthLabel(monthKey: MonthKey): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${GEORGIAN_MONTHS[month]} ${year}`;
}

/**
 * Returns the last N calendar months relative to today, most recent last
 * (so they render left-to-right as oldest → newest in tab order).
 * The caller is responsible for filtering to only months that actually
 * have data — this just generates the candidate list.
 */
export function getLastNMonths(n: number): MonthOption[] {
  const today = new Date();
  const months: MonthOption[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = subMonths(today, i);
    const key = format(date, "yyyy-MM");
    months.push({ key, label: getMonthLabel(key) });
  }
  return months;
}
