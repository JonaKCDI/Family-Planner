import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { toExpenseDocumentItem, toExpenseListItem } from "@/lib/expense-list";
import { getMonthKey, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { filterExpenseFacets, normalizeList } from "@/lib/expense-filters";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { sortExpenseEntries } from "@/lib/expense-sorting";
import { getDocumentsForLinkedEntities, getVisibleExpenses } from "@/lib/queries";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const params = searchParamsToExpenseParams(url.searchParams);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 10000);
  const limit = boundedInteger(url.searchParams.get("limit"), 100, 1, 100);
  const query = normalizeSearch(params.q);

  const expenses = await getVisibleExpenses(session.family.id, session.user.id);
  const range = getRange(params, getMonthKey(), expenses);
  const selectedLabels = normalizeList(params.label);
  const selectedCategories = normalizeList(params.category);
  const rangeFilteredEntries = expenses
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => selectedLabels.length === 0 || (entry.labelId !== null && selectedLabels.includes(entry.labelId)))
    .filter((entry) => selectedCategories.length === 0 || (entry.categoryId !== null && selectedCategories.includes(entry.categoryId)));
  const facetFilteredEntries = filterExpenseFacets(rangeFilteredEntries, params);
  const searchableDocuments = query
    ? await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", facetFilteredEntries.map((entry) => entry.id))
    : [];
  const searchableDocumentsByExpense = groupBy(searchableDocuments, (document) => document.linkedEntityId ?? "");
  const selectedEntries = facetFilteredEntries
    .filter((entry) => !query || matchesExpenseSearch(entry, query, { documents: searchableDocumentsByExpense[entry.id] ?? [] }));
  const sortedEntries = sortExpenseEntries(selectedEntries, params.sort);
  const entries = sortedEntries.slice(offset, offset + limit);
  const entryIds = new Set(entries.map((entry) => entry.id));
  const documents = query
    ? searchableDocuments.filter((document) => document.linkedEntityId ? entryIds.has(document.linkedEntityId) : false)
    : await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", entries.map((entry) => entry.id));

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
    label: searchParams.getAll("label"),
    category: searchParams.getAll("category"),
    kind: searchParams.get("kind"),
    paymentMethod: searchParams.getAll("paymentMethod"),
    source: searchParams.getAll("source"),
    q: searchParams.get("q"),
    sort: searchParams.get("sort")
  };
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getRange(params: ExpenseFilterParams, currentMonthKey: string, expenses: Awaited<ReturnType<typeof getVisibleExpenses>>) {
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
  if (hasFacetFilter(params)) {
    return allExpenseRange(expenses) ?? fallbackMonth;
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

function allExpenseRange(expenses: Awaited<ReturnType<typeof getVisibleExpenses>>) {
  if (expenses.length === 0) return null;
  const times = expenses.map((expense) => new Date(expense.date).getTime());
  return {
    from: new Date(Math.min(...times)),
    to: endOfDay(new Date(Math.max(...times)))
  };
}

function hasFacetFilter(params: ExpenseFilterParams) {
  return Boolean(params.q || normalizeList(params.category).length > 0 || normalizeList(params.label).length > 0 || params.kind || normalizeList(params.paymentMethod).length > 0 || normalizeList(params.source).length > 0);
}

function isInRange(date: Date, from: Date, to: Date) {
  const value = new Date(date).getTime();
  return value >= from.getTime() && value <= to.getTime();
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
