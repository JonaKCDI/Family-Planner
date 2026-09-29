import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getVisibleExpenses, getVisibleCategories, getExpenseLabels, getDocumentsForLinkedEntities } from "@/lib/queries";
import { getFamilyFinance } from "@/lib/family-finance";
import { filterFamilyExpenses, getFamilyExpenseRange } from "@/lib/family-finance-filters";
import { filterExpenseAssignments, filterExpenseFacets } from "@/lib/expense-filters";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { getMonthKey, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { explicitExpensePeriod, getExpenseRange } from "@/lib/expense-range";
import { analysisEntryParams, type AnalysisDimension } from "@/lib/expense-detail-analysis";

export async function loadExpenseAnalysis(params: ExpenseFilterParams, dimension: AnalysisDimension, id: string) {
  if (params.bereich === "familie") {
    const { expenses, categories, labels } = await getFamilyFinance();
    const target = (dimension === "category" ? categories : labels).find(row => row.id === id);
    if (!target && id !== "unassigned") return null;
    const range = getFamilyExpenseRange(expenses, params);
    const context = explicitExpensePeriod(params, range);
    const selected = filterFamilyExpenses(expenses, analysisEntryParams(context, dimension, id));
    return { target: target ?? { name: "Nicht zugeordnet", color: "#6b6f76", icon: "tag" }, range, context, entries: selected, currencies: [params.currency || "EUR"] };
  }
  const session = await requireSession();
  await ensureDueContractExpenses(session.family.id, session.user.id);
  const [expenses, categories, labels] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id, { includeArchived: true })
  ]);
  const target = (dimension === "category" ? categories : labels).find(row => row.id === id);
  if (!target && id !== "unassigned") return null;
  const range = getExpenseRange(params, getMonthKey(), expenses);
  const context = explicitExpensePeriod(params, range);
  const selectedParams = analysisEntryParams(context, dimension, id);
  const candidates = filterExpenseFacets(filterExpenseAssignments(expenses, selectedParams), selectedParams)
    .filter(entry => entry.date >= range.from && entry.date <= range.to);
  const query = (params.q || "").trim().toLowerCase();
  const documents = query ? await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", candidates.map(e => e.id)) : [];
  const docs = new Map<string, typeof documents>();
  for (const document of documents) if (document.linkedEntityId) {
    const list = docs.get(document.linkedEntityId) ?? [];
    list.push(document);
    docs.set(document.linkedEntityId, list);
  }
  const entries = candidates.filter(entry => !query || matchesExpenseSearch(entry, query, { documents: docs.get(entry.id) ?? [] }));
  return { target: target ?? { name: dimension === "category" ? "Ohne Kategorie" : "Ohne Label", color: "#6b6f76", icon: "tag" }, range, context, entries, currencies: [...new Set(entries.map(e => e.currency))].sort() };
}
