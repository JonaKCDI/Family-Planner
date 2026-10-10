import Link from "@/components/finance-link";
import { requireSession } from "@/lib/auth";
import { getFamilyFinance, getFamilyFinanceBounds, getFamilyFinanceForRange, requireFinanceMember } from "@/lib/family-finance";
import { filterFamilyExpenses, getFamilyExpenseRange } from "@/lib/family-finance-filters";
import { buildCategoryRows, buildLabelRows, sumByKind } from "@/lib/expense-analytics";
import { getExpenseRange } from "@/lib/expense-range";
import { filterExpenseAssignments, filterExpenseFacets } from "@/lib/expense-filters";
import { buildAnalysisHref, type AnalysisDimension } from "@/lib/expense-detail-analysis";
import { buildExpensesHref } from "@/lib/expense-filter-url";
import { getVisibleExpenseSummaries, getVisibleExpenses, getVisibleCategories, getExpenseLabels, getDocumentsForLinkedEntities } from "@/lib/queries";
import { getPersonalExpenseCandidates, getPersonalFinanceMetadata, type FinanceExpenseCandidate } from "@/lib/finance-read";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { getMonthKey } from "@/lib/expense-filter-url";
import { formatMoney } from "@/lib/format";
import type { ExpenseFilterParams } from "@/lib/expense-filter-url";

export async function DesktopFinanceAnalysisList({ params, dimension, selectedId, workspaceView }: { params: ExpenseFilterParams; dimension: AnalysisDimension; selectedId: string; workspaceView?: "categories" | "labels" }) {
  const listParams = { ...params, [dimension]: undefined };
  let rows: Array<{ id?: string; name: string; spending: number; income: number; saldo: number }>;
  let amounts: Array<{ categoryId: string | null; labelId: string | null; currency: string; kind: string; amountCents: number }> = [];
  if (params.bereich === "familie") {
    const optimizedReads = process.env.FINANCE_OPTIMIZED_READS !== "0";
    const range = optimizedReads
      ? getFamilyExpenseRange(await getFamilyFinanceBounds((await requireFinanceMember()).family.id), listParams)
      : null;
    const { expenses, categories, labels } = range
      ? await getFamilyFinanceForRange(range)
      : await getFamilyFinance();
    const selected = filterFamilyExpenses(expenses, listParams);
    amounts = selected;
    rows = dimension === "category"
      ? buildCategoryRows(selected, categories, sumByKind(selected, "EXPENSE"), false)
      : buildLabelRows(selected, labels);
  } else {
    const session = await requireSession();
    const query = (listParams.q || "").trim().toLowerCase();
    const optimizedReads = process.env.FINANCE_OPTIMIZED_READS !== "0";
    const metadata = optimizedReads ? await getPersonalFinanceMetadata(session.family.id, session.user.id) : null;
    const scopedRange = metadata ? getExpenseRange(listParams, getMonthKey(), metadata.rangeEntries) : null;
    const [expenses, categories, labels] = await Promise.all([
      scopedRange ? getPersonalExpenseCandidates(session.family.id, session.user.id, scopedRange)
        : query ? getVisibleExpenses(session.family.id, session.user.id) : getVisibleExpenseSummaries(session.family.id, session.user.id),
      getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
      getExpenseLabels(session.family.id, session.user.id, { includeArchived: true })
    ]);
    const range = scopedRange ?? getExpenseRange(listParams, getMonthKey(), expenses);
    const candidates = filterExpenseFacets(filterExpenseAssignments(expenses as FinanceExpenseCandidate[], listParams), listParams)
      .filter((entry) => entry.date >= range.from && entry.date <= range.to);
    const documents = query ? await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", candidates.map((entry) => entry.id)) : [];
    const docs = new Map<string, typeof documents>();
    for (const document of documents) if (document.linkedEntityId) {
      const found = docs.get(document.linkedEntityId) ?? [];
      found.push(document);
      docs.set(document.linkedEntityId, found);
    }
    const selected = candidates.filter((entry) => !query || matchesExpenseSearch(entry, query, { documents: docs.get(entry.id) ?? [] }));
    amounts = selected;
    rows = dimension === "category"
      ? buildCategoryRows(selected, categories, sumByKind(selected, "EXPENSE"), false)
      : buildLabelRows(selected, labels);
  }
  return <nav className="desktop-analysis-list" aria-label={dimension === "category" ? "Kategorien" : "Labels"}>
    <h2>{dimension === "category" ? "Kategorien" : "Labels"}</h2>
    {rows.filter((row) => row.spending > 0 || row.income > 0).map((row) => {
      const id = row.id ?? "unassigned";
      const matching = amounts.filter((entry) => (dimension === "category" ? entry.categoryId : entry.labelId) === (row.id ?? null));
      const currencies = [...new Set(matching.map((entry) => entry.currency))].sort();
      const workspaceHref = buildExpensesHref({ ...params, view: workspaceView });
      return <Link className={selectedId === id ? "active" : ""} href={workspaceView ? `${workspaceHref}${workspaceHref.includes("?") ? "&" : "?"}selected=${encodeURIComponent(id)}` : buildAnalysisHref(listParams, dimension, id, params)} key={id} scroll={false} aria-current={selectedId === id ? "page" : undefined}>
        <span>{row.name}</span><span className="desktop-analysis-amounts">{currencies.map((currency) => {
          const entries = matching.filter((entry) => entry.currency === currency);
          const income = entries.filter((entry) => entry.kind === "INCOME").reduce((sum, entry) => sum + entry.amountCents, 0);
          const spending = entries.filter((entry) => entry.kind === "EXPENSE").reduce((sum, entry) => sum + entry.amountCents, 0);
          const saldo = income - spending;
          return <small key={currency}><strong className={saldo < 0 ? "negative" : "positive"}>Saldo {formatMoney(saldo, currency)}</strong></small>;
        })}</span>
      </Link>;
    })}
  </nav>;
}
