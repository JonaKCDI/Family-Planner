import { getMonthKey, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { normalizeList } from "@/lib/expense-filters";

export const DAY_MS = 86_400_000;
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export function parseCalendarDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value ? date : null;
}

/** Calendar dates are stored as UTC midnight; never apply the server's DST offset. */
export function getExpenseRange(params: ExpenseFilterParams, currentMonthKey = getMonthKey(), expenses: { date: Date | string }[] = []) {
  const monthRange = (key: string) => {
    const from = parseCalendarDate(`${key}-01`);
    return from ? { from, to: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1) - 1) } : null;
  };
  const fallback = monthRange(currentMonthKey) ?? monthRange(getMonthKey())!;
  if (params.from || params.to) {
    const from = parseCalendarDate(params.from) ?? fallback.from;
    const end = parseCalendarDate(params.to);
    const to = end ? new Date(end.getTime() + DAY_MS - 1) : fallback.to;
    if (from <= to) return { mode: "custom" as const, from, to };
    return { mode: "month" as const, key: currentMonthKey, ...fallback };
  }
  if (params.month) {
    const range = monthRange(params.month);
    if (range) return { mode: "month" as const, key: params.month, ...range };
  }
  if (params.year && /^\d{4}$/.test(params.year) && Number(params.year) >= 1900 && Number(params.year) <= 2200) {
    return { mode: "year" as const, from: new Date(`${params.year}-01-01T00:00:00Z`), to: new Date(Date.UTC(Number(params.year) + 1, 0, 1) - 1) };
  }
  const hasFilter = params.q || params.kind || [params.category, params.label, params.paymentMethod, params.source].some(v => normalizeList(v).length > 0);
  if (hasFilter && expenses.length) {
    const times = expenses.map(e => new Date(e.date).getTime()).filter(Number.isFinite);
    if (times.length) {
      const min = times.reduce((a, b) => Math.min(a, b));
      const max = times.reduce((a, b) => Math.max(a, b));
      return { mode: "all" as const, from: new Date(dateKey(new Date(min))), to: new Date(new Date(dateKey(new Date(max))).getTime() + DAY_MS - 1) };
    }
  }
  return { mode: "month" as const, key: currentMonthKey, ...fallback };
}

export function explicitExpensePeriod(params: ExpenseFilterParams, range: { from: Date; to: Date }) {
  return { ...params, year: undefined, month: undefined, from: dateKey(range.from), to: dateKey(range.to) };
}
