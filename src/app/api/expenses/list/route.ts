import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { toExpenseDocumentItem, toExpenseListItem } from "@/lib/expense-list";
import { getMonthKey, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { getDocumentsForLinkedEntities, getVisibleExpenses } from "@/lib/queries";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const params = searchParamsToExpenseParams(url.searchParams);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 10000);
  const limit = boundedInteger(url.searchParams.get("limit"), 100, 1, 100);
  const range = getRange(params, getMonthKey());
  const query = normalizeSearch(params.q);

  const expenses = await getVisibleExpenses(session.family.id, session.user.id);
  const selectedEntries = expenses
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => !params.label || entry.labelId === params.label)
    .filter((entry) => !params.category || entry.categoryId === params.category)
    .filter((entry) => !query || matchesExpense(entry, query));
  const entries = selectedEntries.slice(offset, offset + limit);
  const documents = await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", entries.map((entry) => entry.id));

  return NextResponse.json({
    entries: entries.map(toExpenseListItem),
    totalCount: selectedEntries.length,
    documentsByExpense: groupBy(documents.map(toExpenseDocumentItem), (document) => document.linkedEntityId ?? "")
  });
}

function searchParamsToExpenseParams(searchParams: URLSearchParams): ExpenseFilterParams {
  return {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    year: searchParams.get("year"),
    month: searchParams.get("month"),
    label: searchParams.get("label"),
    category: searchParams.get("category"),
    q: searchParams.get("q")
  };
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getRange(params: ExpenseFilterParams, currentMonthKey: string) {
  const fallbackMonth = monthRange(currentMonthKey) ?? monthRange(getMonthKey())!;
  if (params.from || params.to) {
    return {
      from: params.from ? new Date(params.from) : fallbackMonth.from,
      to: params.to ? endOfDay(new Date(params.to)) : fallbackMonth.to
    };
  }
  if (params.month) {
    const range = monthRange(params.month);
    if (range) return range;
  }
  if (params.year) {
    const year = Number(params.year);
    return { from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
  }
  return fallbackMonth;
}

function monthRange(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { from: new Date(year, month - 1, 1), to: endOfDay(new Date(year, month, 0)) };
}

function endOfDay(date: Date) {
  date.setHours(23, 59, 59, 999);
  return date;
}

function isInRange(date: Date, from: Date, to: Date) {
  const value = new Date(date).getTime();
  return value >= from.getTime() && value <= to.getTime();
}

function matchesExpense(entry: Awaited<ReturnType<typeof getVisibleExpenses>>[number], query: string) {
  return [
    entry.description,
    entry.store,
    entry.paymentMethod,
    entry.category?.name,
    entry.label?.name,
    entry.contract?.provider,
    entry.contract?.contractType,
    entry.kind === "INCOME" ? "einnahme" : "ausgabe",
    entry.currency
  ].some((value) => normalizeSearch(value).includes(query));
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}
