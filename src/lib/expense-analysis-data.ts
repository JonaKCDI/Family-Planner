import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getVisibleExpenseSummaries, getVisibleExpenses, getVisibleCategories, getExpenseLabels, getDocumentsForLinkedEntities } from "@/lib/queries";
import { getFamilyFinance, getFamilyFinanceBounds, getFamilyFinanceForRange, requireFinanceMember } from "@/lib/family-finance";
import { filterFamilyExpenses, getFamilyExpenseRange } from "@/lib/family-finance-filters";
import { filterExpenseAssignments, filterExpenseFacets } from "@/lib/expense-filters";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { getMonthKey, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { explicitExpensePeriod, getExpenseRange } from "@/lib/expense-range";
import { analysisEntryParams, type AnalysisDimension } from "@/lib/expense-detail-analysis";
import { getPersonalExpenseCandidates, getPersonalFinanceMetadata, type FinanceExpenseCandidate } from "@/lib/finance-read";

export async function loadExpenseAnalysis(params: ExpenseFilterParams, dimension: AnalysisDimension, id: string) {
  if (params.bereich === "familie") {
    const optimizedReads = process.env.FINANCE_OPTIMIZED_READS !== "0";
    const familyRange = optimizedReads
      ? getFamilyExpenseRange(await getFamilyFinanceBounds((await requireFinanceMember()).family.id), params)
      : null;
    const { expenses, categories, labels } = familyRange
      ? await getFamilyFinanceForRange(familyRange)
      : await getFamilyFinance();
    const target = (dimension === "category" ? categories : labels).find(row => row.id === id);
    if (!target && id !== "unassigned") return null;
    const range = familyRange ?? getFamilyExpenseRange(expenses, params);
    const context = explicitExpensePeriod(params, range);
    const selected = filterFamilyExpenses(expenses, analysisEntryParams(context, dimension, id));
    return { target: target ?? { name: "Nicht zugeordnet", color: "#6b6f76", icon: "tag" }, range, context, entries: selected, currencies: [params.currency || "EUR"] };
  }
  const session = await requireSession();
  await ensureDueContractExpenses(session.family.id, session.user.id);
  const query = (params.q || "").trim().toLowerCase();
  const optimizedReads = process.env.FINANCE_OPTIMIZED_READS !== "0";
  const metadata = optimizedReads ? await getPersonalFinanceMetadata(session.family.id, session.user.id) : null;
  const scopedRange = metadata ? getExpenseRange(params, getMonthKey(), metadata.rangeEntries) : null;
  const [expenses, categories, labels] = await Promise.all([
    scopedRange ? getPersonalExpenseCandidates(session.family.id, session.user.id, scopedRange)
      : query ? getVisibleExpenses(session.family.id, session.user.id) : getVisibleExpenseSummaries(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id, { includeArchived: true })
  ]);
  const target = (dimension === "category" ? categories : labels).find(row => row.id === id);
  if (!target && id !== "unassigned") return null;
  const range = scopedRange ?? getExpenseRange(params, getMonthKey(), expenses);
  const context = explicitExpensePeriod(params, range);
  const selectedParams = analysisEntryParams(context, dimension, id);
  const candidates = filterExpenseFacets(filterExpenseAssignments(expenses as FinanceExpenseCandidate[], selectedParams), selectedParams)
    .filter(entry => entry.date >= range.from && entry.date <= range.to);
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
