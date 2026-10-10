import { getExpenseRange as getRange } from "@/lib/expense-range";
import { filterExpenseAssignments } from "@/lib/expense-filters";
import { getFamilyFinance, getFamilyFinanceBounds, getFamilyFinanceForRange, getFamilyFinancePage } from "@/lib/family-finance";
import { filterFamilyExpenses, getFamilyExpenseRange } from "@/lib/family-finance-filters";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { toExpenseDocumentItem, toExpenseListItem } from "@/lib/expense-list";
import { getMonthKey, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { filterExpenseFacets } from "@/lib/expense-filters";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { sortExpenseEntries } from "@/lib/expense-sorting";
import { getDocumentsForLinkedEntities, getVisibleExpenses, getVisibleExpensesByIds, getVisibleDocumentRoots } from "@/lib/queries";
import { getPersonalExpenseCandidates, getPersonalExpensePage, getPersonalFinanceMetadata } from "@/lib/finance-read";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const params = searchParamsToExpenseParams(url.searchParams);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 10000);
  const limit = boundedInteger(url.searchParams.get("limit"), 100, 1, 100);
  if (url.searchParams.get("bereich") === "familie") {
    const familyParams = { ...params, person: url.searchParams.get("person"), currency: url.searchParams.get("currency") };
    const familyRange = process.env.FINANCE_OPTIMIZED_READS !== "0"
      ? getFamilyExpenseRange(await getFamilyFinanceBounds(session.family.id), familyParams)
      : null;
    const familyPage = familyRange ? await getFamilyFinancePage(familyRange, familyParams, offset, limit) : null;
    if (familyPage) return familyListResponse(session, familyPage.expenses, familyPage.totalCount);
    const { expenses } = familyRange ? await getFamilyFinanceForRange(familyRange) : await getFamilyFinance();
    const selected = filterFamilyExpenses(expenses, familyParams);
    const rows = selected.slice(offset, offset + limit);
    return familyListResponse(session, rows, selected.length);
  }
  const query = normalizeSearch(params.q);

  const optimizedReads = process.env.FINANCE_OPTIMIZED_READS !== "0";
  const metadata = optimizedReads ? await getPersonalFinanceMetadata(session.family.id, session.user.id) : null;
  const historicalExpenses = optimizedReads ? null : await getVisibleExpenses(session.family.id, session.user.id);
  const range = getRange(params, getMonthKey(), metadata?.rangeEntries ?? historicalExpenses ?? []);
  const page = optimizedReads
    ? await getPersonalExpensePage(session.family.id, session.user.id, range, params, offset, limit)
    : null;
  if (page) {
    const [fullEntries, documents] = await Promise.all([
      getVisibleExpensesByIds(session.family.id, session.user.id, page.ids),
      getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", page.ids)
    ]);
    const byId = new Map(fullEntries.map(entry => [entry.id, entry]));
    return NextResponse.json({
      entries: page.ids.flatMap(id => byId.has(id) ? [toExpenseListItem(byId.get(id)!)] : []),
      totalCount: page.totalCount,
      documentsByExpense: groupBy(documents.map(toExpenseDocumentItem), document => document.linkedEntityId ?? "")
    });
  }
  const expenses = optimizedReads
    ? await getPersonalExpenseCandidates(session.family.id, session.user.id, range)
    : historicalExpenses!;
  const rangeFilteredEntries = filterExpenseAssignments(expenses, params)
    .filter((entry) => isInRange(entry.date, range.from, range.to));
  const facetFilteredEntries = filterExpenseFacets(rangeFilteredEntries, params);
  const searchableDocuments = query
    ? await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", facetFilteredEntries.map((entry) => entry.id))
    : [];
  const searchableDocumentsByExpense = groupBy(searchableDocuments, (document) => document.linkedEntityId ?? "");
  const selectedEntries = facetFilteredEntries
    .filter((entry) => !query || matchesExpenseSearch(entry, query, { documents: searchableDocumentsByExpense[entry.id] ?? [] }));
  const sortedEntries = sortExpenseEntries(selectedEntries, params.sort);
  const entries = sortedEntries.slice(offset, offset + limit);
  const fullEntries = await getVisibleExpensesByIds(session.family.id, session.user.id, entries.map(entry => entry.id));
  const fullById = new Map(fullEntries.map(entry => [entry.id, entry]));
  const entryIds = new Set(entries.map((entry) => entry.id));
  const documents = query
    ? searchableDocuments.filter((document) => document.linkedEntityId ? entryIds.has(document.linkedEntityId) : false)
    : await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", entries.map((entry) => entry.id));

  return NextResponse.json({
    entries: entries.flatMap(entry => {
      const full = fullById.get(entry.id);
      return full ? [toExpenseListItem(full)] : [];
    }),
    totalCount: selectedEntries.length,
    documentsByExpense: groupBy(documents.map(toExpenseDocumentItem), (document) => document.linkedEntityId ?? "")
  });
}

async function familyListResponse(session: Awaited<ReturnType<typeof requireSession>>, rows: Awaited<ReturnType<typeof getFamilyFinance>>["expenses"], totalCount: number) {
    const own = await getVisibleExpensesByIds(session.family.id, session.user.id, rows.map(e => e.id));
    const ownById = new Map(own.map(entry => [entry.id, entry]));
    const roots = await getVisibleDocumentRoots(session.family.id, session.user.id, session.role);
    const docs = (await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", rows.map(e=>e.id))).filter(d => !d.documentRootId || roots.some(r => r.id === d.documentRootId));
    return NextResponse.json({ totalCount, documentsByExpense: groupBy(docs.map(toExpenseDocumentItem), d=>d.linkedEntityId??""), entries: rows.map(e=>({
      id:e.id,date:e.date.toISOString(),kind:"EXPENSE",amountCents:e.amountCents,currency:e.currency,description:e.description,store:e.store,paymentMethod:e.paymentMethod,categoryId:e.categoryId,labelId:e.labelId,category:e.category,label:e.label,personName:e.person.name,canEdit:e.canEdit,sharedWithFamily:true,
      editExpense:e.canEdit && ownById.get(e.id) ? toExpenseListItem(ownById.get(e.id)!) : undefined,
      contractId:null,fuelEntryId:null,recurringTransactionId:null,contract:null,fuelEntry:null,recurringTransaction:null,generatedByContract:false,generatedByFuelEntry:false,generatedByRecurringTransaction:false
    })) });
}

function searchParamsToExpenseParams(searchParams: URLSearchParams): ExpenseFilterParams {
  return {
    currency: searchParams.get("currency"),
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
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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
