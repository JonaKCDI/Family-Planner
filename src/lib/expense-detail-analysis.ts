import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { DAY_MS, dateKey } from "@/lib/expense-range";

export type AnalysisDimension = "category" | "label";
export type AnalysisGranularity = "week" | "month" | "year";
export type AnalysisPeriod = { from: string; to: string; label: string; shortLabel: string; partial: boolean; spending: number; income: number; count: number };

function addCalendarMonths(date: Date, months: number) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return first;
}

export function analysisGranularity(from: Date, endExclusive: Date): AnalysisGranularity {
  if (endExclusive > addCalendarMonths(from, 36)) return "year";
  if (endExclusive > addCalendarMonths(from, 3)) return "month";
  return "week";
}

export function buildAnalysisPeriods(entries: { date: Date | string; kind: string; amountCents: number }[], range: { from: Date; to: Date }) {
  const from = new Date(dateKey(range.from));
  const end = new Date(new Date(dateKey(range.to)).getTime() + DAY_MS);
  const granularity = analysisGranularity(from, end);
  const periods: AnalysisPeriod[] = [];
  let cursor = new Date(from);
  if (granularity === "week") cursor.setUTCDate(cursor.getUTCDate() - (cursor.getUTCDay() + 6) % 7);
  else if (granularity === "month") cursor.setUTCDate(1);
  else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
  const dayLabel = (date: Date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date);
  while (cursor < end) {
    const next = granularity === "week" ? new Date(cursor.getTime() + 7 * DAY_MS) : addCalendarMonths(cursor, granularity === "month" ? 1 : 12);
    const start = new Date(Math.max(cursor.getTime(), from.getTime()));
    const stop = new Date(Math.min(next.getTime(), end.getTime()) - DAY_MS);
    const label = granularity === "week" ? `${dayLabel(start)}–${dayLabel(stop)}${start.getUTCFullYear() !== stop.getUTCFullYear() ? ` ${start.getUTCFullYear()}/${stop.getUTCFullYear()}` : ` ${stop.getUTCFullYear()}`}`
      : new Intl.DateTimeFormat("de-DE", { ...(granularity === "month" ? { month: "long" as const } : {}), year: "numeric", timeZone: "UTC" }).format(cursor);
    periods.push({ from: dateKey(start), to: dateKey(stop), label, shortLabel: granularity === "week" ? dayLabel(start) : granularity === "month" ? new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(cursor) : String(cursor.getUTCFullYear()), partial: start > cursor || next > end, spending: 0, income: 0, count: 0 });
    cursor = next;
  }
  for (const entry of entries) {
    const key = dateKey(new Date(entry.date));
    const period = periods.find(p => key >= p.from && key <= p.to);
    if (!period) continue;
    if (entry.kind === "EXPENSE") { period.spending += entry.amountCents; period.count++; }
    if (entry.kind === "INCOME") period.income += entry.amountCents;
  }
  return { granularity, periods };
}

export function analysisEntryParams(params: ExpenseFilterParams, dimension: AnalysisDimension, id: string): ExpenseFilterParams {
  return { ...params, [dimension]: id, view: "entries" };
}

/** Keep the original filters in the detail URL; the route ID only narrows the detail data. */
export function buildAnalysisHref(params: ExpenseFilterParams, dimension: AnalysisDimension, id: string, returnParams = params) {
  const source = buildExpensesHref(params, { view: dimension === "category" ? "categories" : "labels" });
  const query = new URLSearchParams(source.split("?")[1]);
  query.set("analysisReturn", buildExpensesHref(returnParams).split("?")[1] ?? "");
  return `/ausgaben/analyse/${dimension === "category" ? "kategorie" : "label"}/${encodeURIComponent(id)}?${query}`;
}

export function buildAnalysisBackHref(params: ExpenseFilterParams, dimension: AnalysisDimension) {
  const source = typeof params.analysisReturn === "string" ? new URLSearchParams(params.analysisReturn) : null;
  const original: ExpenseFilterParams = source ? Object.fromEntries([...source.keys()].map(key => [key, source.getAll(key).length > 1 ? source.getAll(key) : source.get(key)])) : params;
  return buildExpensesHref(original, { view: dimension === "category" ? "categories" : "labels" });
}
