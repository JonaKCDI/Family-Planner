import { mergeDuplicateExpenses } from "@/lib/actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import {
  buildCategoryRows,
  buildDonutSegments,
  buildExpenseTrendChart,
  buildLabelRows,
  buildPeriodRows,
  findDominantDonutSegment,
  formatDonutPercent,
  sumByKind,
  type DonutSegment,
  type ExpenseChartDimension,
  type ExpenseChartMetric,
  type ExpenseTrendChart,
  type PeriodRow
} from "@/lib/expense-analytics";
import { toExpenseDocumentItem, toExpenseListItem } from "@/lib/expense-list";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { expenseSortOptions, getExpenseSortKey, sortExpenseEntries } from "@/lib/expense-sorting";
import { formatDate, formatMoney } from "@/lib/format";
import { buildExpensesHref, buildMonthNavigationHref, buildPeriodHref, buildYearNavigationHref, getCanonicalExpensesHref, getMonthKey, getRawExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { expenseSource, filterExpenseFacets, normalizeList, sourceLabel } from "@/lib/expense-filters";
import { formatMonthKeyLabel } from "@/lib/month-options";
import { getDocumentsForLinkedEntities, getExpenseLabels, getRecurringTransactions, getVisibleCategories, getVisibleContracts, getVisibleExpenses } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BanknoteArrowUp, CalendarCheck, ListFilter, ReceiptText, Scale, WalletCards } from "lucide-react";
import { RecurringTransactionsPanel } from "@/components/expense-setup-panel";
import { ExpenseEntryList } from "@/components/expense-entry-list";
import { FinanceToolbar } from "@/components/finance-toolbar";
import { FinanceTransitionMarker } from "@/components/finance-transition-marker";
import { CategoryIcon } from "@/components/category-icon";
import { PeriodNavLink } from "@/components/period-nav-link";
import { EmptyState, PageHeader } from "@/components/ui";

type ExpensesPageProps = {
  searchParams: Promise<ExpenseFilterParams>;
};

type FinanceView = "overview" | "entries" | "categories" | "budgets" | "labels" | "compare";

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const canonicalHref = getCanonicalExpensesHref(params);
  if (canonicalHref !== getRawExpensesHref(params)) redirect(canonicalHref);
  await ensureDueContractExpenses(session.family.id, session.user.id);
  const [expenses, categories, labels, allLabels, contracts, recurringTransactions] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getExpenseLabels(session.family.id, session.user.id, { includeArchived: true }),
    getVisibleContracts(session.family.id, session.user.id),
    getRecurringTransactions(session.family.id, session.user.id)
  ]);
  const query = normalizeSearch(params.q);
  const currentMonthKey = getMonthKey();
  const currentYear = Number(currentMonthKey.slice(0, 4));
  const years = [...new Set([currentYear, ...expenses.map((entry) => new Date(entry.date).getFullYear())])].sort((a, b) => b - a);
  const range = getRange(params, currentMonthKey, expenses);
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
  const view = getExpenseView(params.view);
  const sortKey = getExpenseSortKey(params.sort);
  const sortedEntries = sortExpenseEntries(selectedEntries, sortKey);
  const recentEntries = sortExpenseEntries(selectedEntries, "date-desc").slice(0, 10);
  const duplicateGroups = view === "entries" ? buildDuplicateGroups(selectedEntries) : [];
  const duplicateCounts = view === "entries" ? buildDuplicateCounts(duplicateGroups) : {};
  const income = sumByKind(selectedEntries, "INCOME");
  const spending = sumByKind(selectedEntries, "EXPENSE");
  const saldo = income - spending;
  const netConsumption = Math.max(0, spending - income);
  const showBudget = range.mode === "month";
  const monthBudget = showBudget ? categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0) : 0;
  const categoryRows = buildCategoryRows(selectedEntries, categories, spending, showBudget);
  const labelRows = buildLabelRows(selectedEntries, labels);
  const categoryAnalysisRows = categoryRows.filter((row) => row.spending > 0 || row.income > 0);
  const labelAnalysisRows = labelRows.filter((row) => row.spending > 0 || row.income > 0);
  const monthlyRows = buildPeriodRows(selectedEntries, categories, "month");
  const chartDimension: ExpenseChartDimension = "category";
  const chartMetric: ExpenseChartMetric = "spending";
  const chartTop = 5;
  const chartMonths = 6;
  const analysisRows = categoryAnalysisRows;
  const donutSegments = buildDonutSegments(analysisRows, { maxSegments: 5 });
  const dominantSegment = findDominantDonutSegment(donutSegments);
  const trendBaseEntries = buildAnalyticsScopeEntries(expenses, params, query);
  const expenseTrendChart = buildExpenseTrendChart(trendBaseEntries, {
    dimension: chartDimension,
    metric: chartMetric,
    months: chartMonths,
    topN: chartTop,
    endDate: range.to
  });
  const trendDominance = findDominantTrendSeries(expenseTrendChart);
  const comparisonRange = getComparisonRange(params, range);
  const comparisonEntries = buildComparableEntries(expenses, params, comparisonRange, query);
  const comparison = buildPeriodComparison(selectedEntries, comparisonEntries, categories, range, comparisonRange);
  const insights = buildAnalysisInsights({
    params,
    selectedEntries,
    allEntries: expenses,
    categoryRows,
    labelRows,
    range,
    monthBudget,
    netConsumption,
    showBudget,
    currentMonthKey
  });
  const activeFilterChips = buildActiveFilterChips(params, categories, allLabels, range);
  const paymentMethods = buildPaymentMethodOptions(expenses);
  const activeFilterCount = countActiveFinanceFilters(params);
  const initialEntryLimit = view === "entries" ? getInitialEntryLimit(range.mode) : 0;
  const initialEntries = view === "entries" ? sortedEntries.slice(0, initialEntryLimit) : view === "overview" ? recentEntries : [];
  const initialEntryIds = new Set(initialEntries.map((expense) => expense.id));
  const shouldLoadEntryDocuments = view === "entries" || view === "overview";
  const documents = shouldLoadEntryDocuments ? (query
    ? searchableDocuments.filter((document) => document.linkedEntityId ? initialEntryIds.has(document.linkedEntityId) : false)
    : await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", initialEntries.map((expense) => expense.id))) : [];
  const documentsByExpense = groupBy(documents.map(toExpenseDocumentItem), (document) => document.linkedEntityId ?? "");
  const expenseListEntries = initialEntries.map(toExpenseListItem);
  const expenseListLoadUrl = buildExpenseListLoadUrl(params);
  const returnTo = getRawExpensesHref(params);
  const focusTitle = getAnalysisFocusTitle(params, categories, allLabels);
  const budgetRemaining = monthBudget - netConsumption;
  const isAnalysisArea = isFinanceAnalysisView(view);
  const summaryMax = Math.max(income, spending, Math.abs(saldo), Math.abs(budgetRemaining), 1);
  const budgetUsageWidth = showBudget && monthBudget > 0 ? `${Math.max(4, Math.min(100, (netConsumption / monthBudget) * 100))}%` : "0%";

  return (
    <>
      <FinanceTransitionMarker view={view} />
      <div className="task-page-head finance-page-head">
        <PageHeader title="Finanzen" />
        <FinanceToolbar
          params={params}
          categories={categories}
          labels={labels}
          years={years}
          currentMonthKey={currentMonthKey}
          paymentMethods={paymentMethods}
          resultCount={selectedEntries.length}
          activeFilterCount={activeFilterCount}
        />
      </div>

      <nav className="finance-primary-tabs" id="finanzansichten" aria-label="Finanzbereich">
        <Link className={!isAnalysisArea ? "active" : ""} href={financeViewHref(params, "overview")} scroll={false}>Übersicht</Link>
        <Link className={isAnalysisArea ? "active" : ""} href={financeViewHref(params, "categories")} scroll={false}>Analyse</Link>
        <Link href="/ausgaben/planung" scroll={false}>Planung</Link>
      </nav>

      <section className="filter-system" aria-label="Ausgabenfilter">
        <div className="period-navigator">
          <PeriodNavigator params={params} range={range} currentMonthKey={currentMonthKey} />
        </div>
        <div className="overview-actions secondary-filter-actions expense-secondary-actions">
          <ActionModal title="Serien verwalten" trigger="Serien" modalId="ausgaben-serien" wide>
            <RecurringTransactionsPanel recurringTransactions={recurringTransactions} categories={categories} labels={labels} />
          </ActionModal>
          <Link className="button secondary" href="/ausgaben/setup">Setup</Link>
        </div>
        {activeFilterChips.length > 0 ? (
          <div className="active-filter-row" aria-label="Aktive Filter">
            {activeFilterChips.map((chip) => (
              <a className="filter-chip" href={buildExpensesHref(params, chip.clear)} key={chip.label}>
                <span>{chip.label}</span>
                <strong aria-hidden="true">×</strong>
              </a>
            ))}
            <a className="filter-chip clear-all" href="/ausgaben">Alle löschen</a>
          </div>
        ) : null}
      </section>

      {isAnalysisArea ? (
        <nav className="finance-analysis-subtabs" aria-label="Analysebereiche">
          <Link className={view === "categories" ? "active" : ""} href={financeViewHref(params, "categories")} scroll={false}>Kategorien</Link>
          <Link className={view === "budgets" ? "active" : ""} href={financeViewHref(params, "budgets")} scroll={false}>Budgets</Link>
          <Link className={view === "labels" ? "active" : ""} href={financeViewHref(params, "labels")} scroll={false}>Labels</Link>
          <Link className={view === "compare" ? "active" : ""} href={financeViewHref(params, "compare")} scroll={false}>Vergleich</Link>
        </nav>
      ) : (
        <nav className="finance-analysis-subtabs" aria-label="Übersichtsbereiche">
          <Link className={view === "overview" ? "active" : ""} href={financeViewHref(params, "overview")} scroll={false}>Überblick</Link>
          <Link className={view === "entries" ? "active" : ""} href={financeViewHref(params, "entries")} scroll={false}>Einträge</Link>
        </nav>
      )}

      {view === "overview" ? (
      <section className="finance-overview-page spacing-top" id="ueberblick">
        <section className="finance-summary-panel" aria-label="Finanzüberblick">
          <div className="finance-summary-metric tone-income">
            <div className="finance-summary-card-head">
              <span>Einnahmen</span>
              <i aria-hidden="true"><BanknoteArrowUp size={17} /></i>
            </div>
            <strong>{formatMoney(income)}</strong>
            <small>{income > 0 ? "Geldzufluss im Zeitraum" : "Keine Einnahmen im Zeitraum"}</small>
            <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: percentWidth(income, summaryMax) }} /></div>
          </div>
          <div className="finance-summary-metric tone-spending">
            <div className="finance-summary-card-head">
              <span>Ausgaben</span>
              <i aria-hidden="true"><ReceiptText size={17} /></i>
            </div>
            <strong>{formatMoney(spending)}</strong>
            <small>{spending > income ? "Über den Einnahmen" : "Durch Einnahmen gedeckt"}</small>
            <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: percentWidth(spending, summaryMax) }} /></div>
          </div>
          <div className={`finance-summary-metric ${saldo < 0 ? "tone-negative" : "tone-positive"}`}>
            <div className="finance-summary-card-head">
              <span>Saldo</span>
              <i aria-hidden="true"><Scale size={17} /></i>
            </div>
            <strong>{formatMoney(saldo)}</strong>
            <small>{saldo < 0 ? "Mehr ausgegeben als eingenommen" : "Einnahmen decken die Ausgaben"}</small>
            <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: percentWidth(saldo, summaryMax) }} /></div>
          </div>
          <div className={`finance-summary-metric ${showBudget ? budgetRemaining < 0 ? "tone-negative" : "tone-positive" : "tone-neutral"}`}>
            <div className="finance-summary-card-head">
              <span>{showBudget ? "Budget übrig" : "Budget"}</span>
              <i aria-hidden="true"><WalletCards size={17} /></i>
            </div>
            {showBudget ? (
              <>
                <strong>{formatMoney(budgetRemaining)}</strong>
                <small>{formatMoney(netConsumption)} netto verbraucht</small>
                <div className="finance-summary-spark budget-spark" aria-hidden="true"><b style={{ width: budgetUsageWidth }} /></div>
              </>
            ) : (
              <>
                <strong>Monat wählen</strong>
                <small>Budgetreste gibt es in der Monatsansicht</small>
                <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: "0%" }} /></div>
              </>
            )}
          </div>
        </section>

        <section className="panel finance-overview-snapshot">
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Ausgaben nach Kategorie</h2>
              <p className="muted">Vorschau der wichtigsten Kategorien.</p>
            </div>
            <Link className="button secondary" href={financeViewHref(params, "categories")} scroll={false}>Alle</Link>
          </div>
          <BudgetPressureList rows={categoryRows} showBudget={showBudget} />
        </section>

        <section className="panel finance-overview-snapshot">
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Letzte Buchungen</h2>
              <p className="muted">{formatDate(range.from)} bis {formatDate(range.to)}</p>
            </div>
            <Link className="button secondary" href={financeViewHref(params, "entries")} scroll={false}>Alle</Link>
          </div>
          {initialEntries.length === 0 ? (
            <EmptyState>Noch keine Einträge im gewählten Zeitraum.</EmptyState>
          ) : (
            <ExpenseEntryList
              initialEntries={expenseListEntries}
              totalCount={expenseListEntries.length}
              duplicateCounts={{}}
              categories={categories.map((category) => ({ id: category.id, name: category.name, color: category.color, icon: category.icon }))}
              labels={labels.map((label) => ({ id: label.id, name: label.name, color: label.color }))}
              contracts={contracts.map((contract) => ({ id: contract.id, provider: contract.provider, contractType: contract.contractType }))}
              initialDocumentsByExpense={documentsByExpense}
              loadUrl={expenseListLoadUrl}
              returnTo={returnTo}
              pageSize={10}
            />
          )}
        </section>

        <Link className="finance-inline-analysis-link" href={financeViewHref(params, "categories")} scroll={false}>Detaillierte Analyse ansehen <span aria-hidden="true">→</span></Link>
      </section>
      ) : null}

      {view === "entries" ? (
      <section className="panel expense-section" id="eintraege">
        <div className="expense-section-summary">
          <div className="expense-section-heading">
            <h2 className="section-title">Einträge</h2>
            <p className="muted expense-section-meta">{formatDate(range.from)} bis {formatDate(range.to)} · {selectedEntries.length} Einträge</p>
          </div>
          {selectedEntries.length > 0 ? <ExpenseSortControl params={params} sortKey={sortKey} /> : null}
        </div>
        {selectedEntries.length === 0 ? (
          <EmptyState>Noch keine Einträge im gewählten Zeitraum.</EmptyState>
        ) : (
          <>
            <DuplicateReviewPanel groups={duplicateGroups} returnTo={returnTo} />
            <ExpenseEntryList
              initialEntries={expenseListEntries}
              totalCount={selectedEntries.length}
              duplicateCounts={duplicateCounts}
              categories={categories.map((category) => ({ id: category.id, name: category.name, color: category.color, icon: category.icon }))}
              labels={labels.map((label) => ({ id: label.id, name: label.name, color: label.color }))}
              contracts={contracts.map((contract) => ({ id: contract.id, provider: contract.provider, contractType: contract.contractType }))}
              initialDocumentsByExpense={documentsByExpense}
              loadUrl={expenseListLoadUrl}
              returnTo={returnTo}
              pageSize={100}
            />
          </>
        )}
      </section>
      ) : null}

      {view === "categories" ? (
      <section className="analysis-tabs spacing-top" id="kategorien">
        <section className="panel finance-category-page">
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Kategorien</h2>
              <p className="muted">Ausgaben im gewählten Zeitraum.</p>
            </div>
            <div className="overview-actions">
              {params.category ? <a className="button secondary" href={buildExpensesHref(params, { category: undefined, view: "categories" })}>Kategorie lösen</a> : null}
            </div>
          </div>
          {focusTitle ? <AnalysisFocusPanel title={focusTitle} income={income} spending={spending} saldo={saldo} netConsumption={netConsumption} entryCount={selectedEntries.length} /> : null}
          <div className="list finance-analysis-list">
            {categoryAnalysisRows.length === 0 ? <EmptyState>Noch keine Kategorien im Zeitraum.</EmptyState> : null}
            {categoryAnalysisRows.map((row) => (
              <AnalysisRow
                href={analysisRowHref(params, "category", row.id)}
                key={row.name}
                row={row}
                showBudget={false}
                percent={row.percent}
              />
            ))}
          </div>
          <div className="insight-list finance-compact-insights" aria-label="Analysehinweise">
            {insights.slice(0, 2).map((insight) => (
              <a className={`insight-card ${insight.tone}`} href={insight.href} key={insight.title}>
                <span>{insight.label}</span>
                <strong>{insight.title}</strong>
                <small>{insight.detail}</small>
              </a>
            ))}
          </div>
          <details className="finance-chart-disclosure">
            <summary>Diagramme anzeigen</summary>
            <div className="finance-chart-disclosure-body">
              <div className="analysis-chart-status">
                <strong>Diagramme</strong>
                <span>Kategorien · Ausgaben · Top {chartTop} · {chartMonths} Monate</span>
              </div>
              {dominantSegment ? (
                <div className="chart-dominance-note">
                  <strong>{dominantSegment.name} dominiert diesen Zeitraum mit {formatMoney(dominantSegment.value)}.</strong>
                  <span>Die übrigen Kategorien ergeben zusammen {formatMoney(dominantSegment.remainingValue)}. Deshalb ist ein Kreisdiagramm hier wenig aussagekräftig.</span>
                </div>
              ) : null}
              <div className="analysis-overview">
                <div className="pie-card">
                  <div>
                    <h3>Kategorien</h3>
                    <p className="muted">Anteile im gewählten Zeitraum.</p>
                  </div>
                  {dominantSegment ? null : <DonutChart segments={donutSegments} />}
                  <div className="pie-legend modern-chart-legend">
                    {donutSegments.length === 0 ? <span><i />Keine Ausgaben im Zeitraum</span> : null}
                    {donutSegments.map((segment) => (
                      <a href={analysisLegendHref(params, chartDimension, analysisRows, segment)} className="chart-legend-row" key={segment.name}>
                        <span><i style={{ background: segment.color }} />{segment.name}</span>
                        <strong>{formatMoney(segment.value)} · {formatDonutPercent(segment.percent)}</strong>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              {trendDominance ? (
                <div className="chart-dominance-note">
                  <strong>{trendDominance.name} dominiert den {chartMonths}-Monats-Verlauf mit {formatMoney(trendDominance.total)}.</strong>
                  <span>Die übrigen sichtbaren Reihen ergeben zusammen {formatMoney(trendDominance.remainingValue)}. Der Verlauf ist deshalb vor allem als Ausreißer-Hinweis zu lesen.</span>
                </div>
              ) : null}
              <ExpenseTrendChartView chart={expenseTrendChart} params={params} dimension={chartDimension} metric={chartMetric} />
            </div>
          </details>
        </section>
      </section>
      ) : null}

      {view === "budgets" ? (
      <section className="analysis-tabs spacing-top" id="budgets">
        <section className="panel finance-category-page">
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Budgets</h2>
              <p className="muted">{showBudget ? "Monatliche Budgets und Restbeträge." : "Budgets werden in der Monatsansicht bewertet."}</p>
            </div>
          </div>
          <BudgetPressureList rows={categoryRows} showBudget={showBudget} />
          <div className="analysis-grid period-analysis-grid finance-mini-periods">
            <div><h3>Monatsübersicht</h3><MiniTable rows={monthlyRows} showBudget /></div>
          </div>
        </section>
      </section>
      ) : null}

      {view === "labels" ? (
      <section className="analysis-tabs spacing-top" id="labels">
        <section className="panel finance-category-page">
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Labels</h2>
              <p className="muted">Projekte und Erstattungen über Kategorien hinweg.</p>
            </div>
          </div>
          <div className="list finance-analysis-list">
            {labelAnalysisRows.length === 0 ? <EmptyState>Noch keine Labels im Zeitraum.</EmptyState> : null}
            {labelAnalysisRows.map((row) => (
              <AnalysisRow
                href={analysisRowHref(params, "label", row.id)}
                key={row.name}
                row={row}
                showBudget={false}
                percent={undefined}
                meta={labelRowMeta(row)}
              />
            ))}
          </div>
        </section>
      </section>
      ) : null}

      {view === "compare" ? (
      <section className="analysis-tabs spacing-top" id="vergleich">
        <section className="panel finance-compare-page">
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Vergleich</h2>
            </div>
          </div>
          <ComparisonRangeForm params={params} comparisonRange={comparisonRange} years={years} />
          <PeriodComparisonView comparison={comparison} />
        </section>
      </section>
      ) : null}

    </>
  );
}

type DuplicateGroup = {
  key: string;
  entries: ExpenseLike[];
};

function financeViewHref(params: Awaited<ExpensesPageProps["searchParams"]>, view: FinanceView) {
  return `${buildExpensesHref(params, { view })}#finanzansichten`;
}

function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (segments.length === 0) {
    return (
      <div className="donut-chart empty-donut" aria-label="Keine Ausgaben für das Diagramm">
        <svg viewBox="0 0 120 120" role="img">
          <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" strokeWidth="18" />
          <text x="60" y="57" textAnchor="middle">0</text>
          <text x="60" y="73" textAnchor="middle">EUR</text>
        </svg>
      </div>
    );
  }
  return (
    <div className="donut-chart" aria-label={`Ausgabenanteile gesamt ${formatMoney(total)}`}>
      <svg viewBox="0 0 120 120" role="img">
        <circle className="donut-track" cx="60" cy="60" r="42" fill="none" strokeWidth="18" />
        {segments.map((segment) => (
          <circle
            className="donut-segment"
            cx="60"
            cy="60"
            fill="none"
            key={segment.name}
            r="42"
            stroke={segment.color}
            strokeDasharray={segment.strokeDasharray}
            strokeDashoffset={segment.strokeDashoffset}
            strokeLinecap="round"
            strokeWidth="18"
          />
        ))}
        <text x="60" y="56" textAnchor="middle">Gesamt</text>
        <text x="60" y="73" textAnchor="middle">{formatCompactMoney(total)}</text>
      </svg>
    </div>
  );
}

function ExpenseTrendChartView({
  chart,
  params,
  dimension,
  metric
}: {
  chart: ExpenseTrendChart;
  params: Awaited<ExpensesPageProps["searchParams"]>;
  dimension: ExpenseChartDimension;
  metric: ExpenseChartMetric;
}) {
  if (chart.series.length === 0) return <EmptyState>Noch keine Daten für das Zeitdiagramm.</EmptyState>;
  const canBeNegative = metric === "saldo";
  const minValue = canBeNegative ? -chart.maxValue : 0;
  const maxValue = chart.maxValue;
  const valueRange = Math.max(1, maxValue - minValue);
  const width = 320;
  const height = 148;
  const padX = 18;
  const padTop = 18;
  const padBottom = 30;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;
  const zeroY = padTop + ((maxValue - 0) / valueRange) * plotHeight;

  function x(index: number) {
    if (chart.periods.length <= 1) return padX + plotWidth / 2;
    return padX + (index / (chart.periods.length - 1)) * plotWidth;
  }

  function y(value: number) {
    return padTop + ((maxValue - value) / valueRange) * plotHeight;
  }

  return (
    <div className="finance-trend-chart" role="img" aria-label={`${chartMetricLabel(metric)} nach ${dimension === "label" ? "Labels" : "Kategorien"}`}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <line className="finance-chart-grid-line" x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} />
        {[0.25, 0.5, 0.75].map((step) => {
          const gridY = padTop + step * plotHeight;
          return <line className="finance-chart-grid-line muted-line" x1={padX} x2={width - padX} y1={gridY} y2={gridY} key={step} />;
        })}
        {chart.series.map((series) => {
          const points = series.points.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
          return <polyline className="finance-chart-line" fill="none" points={points} stroke={series.color} key={series.name} />;
        })}
        {chart.series.flatMap((series) => series.points.map((point, index) => (
          <circle className="finance-chart-dot" cx={x(index)} cy={y(point.value)} fill={series.color} key={`${series.name}-${point.period}`} r="2.7" />
        )))}
        {chart.periods.map((period, index) => (
          <text className="finance-chart-axis" x={x(index)} y={height - 8} textAnchor="middle" key={period}>{formatMonthShort(period)}</text>
        ))}
      </svg>
      <div className="finance-trend-legend">
        {chart.series.slice(0, 4).map((series) => (
          <a href={trendSeriesHref(params, dimension, series.id)} key={series.name}>
            <i style={{ background: series.color }} aria-hidden="true" />
            <span>{series.name}</span>
            <strong>{formatMoney(series.points.reduce((sum, point) => sum + point.value, 0))}</strong>
          </a>
        ))}
      </div>
    </div>
  );
}

function findDominantTrendSeries(chart: ExpenseTrendChart) {
  if (chart.series.length < 2) return null;
  const totals = chart.series.map((series) => ({
    name: series.name,
    total: series.points.reduce((sum, point) => sum + Math.abs(point.value), 0)
  })).sort((a, b) => b.total - a.total);
  const total = totals.reduce((sum, series) => sum + series.total, 0);
  const [first] = totals;
  if (!first || total <= 0 || (first.total / total) * 100 < 85) return null;
  return {
    ...first,
    remainingValue: Math.max(0, total - first.total)
  };
}

function trendSeriesHref(params: Awaited<ExpensesPageProps["searchParams"]>, dimension: ExpenseChartDimension, id?: string) {
  if (!id) return buildExpensesHref(params, { view: "entries" });
  return dimension === "label"
    ? buildExpensesHref(params, { label: id, category: undefined, view: "entries" })
    : buildExpensesHref(params, { category: id, label: undefined, view: "entries" });
}

function analysisLegendHref(
  params: Awaited<ExpensesPageProps["searchParams"]>,
  dimension: ExpenseChartDimension,
  rows: Array<{ id?: string; name: string }>,
  segment: DonutSegment
) {
  const row = rows.find((item) => item.name === segment.name);
  return analysisRowHref(params, dimension, row?.id);
}

function analysisRowHref(params: Awaited<ExpensesPageProps["searchParams"]>, dimension: ExpenseChartDimension, id?: string) {
  if (!id) return buildExpensesHref(params, { view: "categories" });
  return dimension === "label"
    ? buildExpensesHref(params, { label: id, category: undefined, view: "entries" })
    : buildExpensesHref(params, { category: id, label: undefined, view: "entries" });
}

function formatMonthShort(period: string) {
  const [year, month] = period.split("-");
  return `${month}.${year.slice(2)}`;
}

function PeriodComparisonView({ comparison }: { comparison: ReturnType<typeof buildPeriodComparison> }) {
  const metrics = [
    {
      key: "spending",
      label: "Ausgaben",
      current: comparison.current.spending,
      compare: comparison.compare.spending,
      delta: comparison.delta.spending,
      tone: comparisonTone("spending", comparison.delta.spending),
      changeLabel: comparisonChangeLabel("spending", comparison.delta.spending),
      detail: comparison.delta.spending === 0 ? "unverändert" : comparison.delta.spending > 0 ? "mehr ausgegeben" : "weniger ausgegeben"
    },
    {
      key: "income",
      label: "Einnahmen",
      current: comparison.current.income,
      compare: comparison.compare.income,
      delta: comparison.delta.income,
      tone: comparisonTone("income", comparison.delta.income),
      changeLabel: comparisonChangeLabel("income", comparison.delta.income),
      detail: comparison.delta.income === 0 ? "unverändert" : comparison.delta.income > 0 ? "mehr Einnahmen" : "weniger Einnahmen"
    },
    {
      key: "saldo",
      label: "Saldo",
      current: comparison.current.saldo,
      compare: comparison.compare.saldo,
      delta: comparison.delta.saldo,
      tone: comparisonTone("saldo", comparison.delta.saldo),
      changeLabel: comparisonChangeLabel("saldo", comparison.delta.saldo),
      detail: comparison.delta.saldo === 0 ? "unverändert" : comparison.delta.saldo > 0 ? "Saldo verbessert" : "Saldo verschlechtert"
    }
  ] as const;
  const largestMetric = Math.max(...metrics.flatMap((metric) => [Math.abs(metric.current), Math.abs(metric.compare)]), 1);
  const largestCategory = Math.max(...comparison.rows.flatMap((row) => [row.currentSpending, row.compareSpending]), 1);

  return (
    <div className="period-comparison">
      <div className="comparison-period-strip" aria-label="Verglichene Zeiträume">
        <div>
          <span>Aktuell</span>
          <strong>{comparison.current.label}</strong>
        </div>
        <ArrowRight size={16} aria-hidden="true" />
        <div>
          <span>Vergleich</span>
          <strong>{comparison.compare.label}</strong>
        </div>
      </div>

      <div className="comparison-metric-grid">
        {metrics.map((metric) => (
          <article className={`comparison-metric-card tone-${metric.tone}`} key={metric.key}>
            <div className="comparison-card-head">
              <span>{metric.label}</span>
              <span className="comparison-signal" aria-hidden="true"><TrendIcon delta={metric.delta} /></span>
            </div>
            <strong>{formatMoney(metric.current)}</strong>
            <small>{metric.detail}</small>
            <ComparisonBars current={metric.current} compare={metric.compare} max={largestMetric} />
            <div className="comparison-delta-row">
              <span>{metric.changeLabel}</span>
              <b>{formatSignedMoney(metric.delta)}</b>
            </div>
          </article>
        ))}
      </div>

      <div className="comparison-category-panel">
        <div className="section-head compact-section-head">
          <div>
            <h3 className="section-title">Kategorien</h3>
          </div>
        </div>
        <div className="comparison-category-list" aria-label="Ausgabenvergleich nach Kategorie">
          {comparison.rows.length === 0 ? <EmptyState>Keine Ausgaben nach Kategorie in den Vergleichszeiträumen.</EmptyState> : null}
          {comparison.rows.map((row) => {
            const tone = comparisonTone("spending", row.delta);
            return (
              <article className={`comparison-category-row tone-${tone}`} key={row.name}>
                <div className="comparison-category-main">
                  <strong>{row.name}</strong>
                  <span>{formatPercentDelta(row.delta, row.compareSpending)}</span>
                </div>
                <div className="comparison-category-values">
                  <span>Aktuell <b>{formatMoney(row.currentSpending)}</b></span>
                  <span>Vergleich <b>{formatMoney(row.compareSpending)}</b></span>
                  <span className="comparison-category-delta"><TrendIcon delta={row.delta} /> <b>{formatSignedMoney(row.delta)}</b></span>
                </div>
                <ComparisonBars current={row.currentSpending} compare={row.compareSpending} max={largestCategory} />
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComparisonBars({ current, compare, max }: { current: number; compare: number; max: number }) {
  const currentWidth = percentWidth(current, max);
  const compareWidth = percentWidth(compare, max);
  return (
    <div className="comparison-bars" aria-hidden="true">
      <span className="comparison-bar-row">
        <i className="comparison-bar-label">Aktuell</i>
        <b style={{ width: currentWidth }} />
      </span>
      <span className="comparison-bar-row compare">
        <i className="comparison-bar-label">Vergleich</i>
        <b style={{ width: compareWidth }} />
      </span>
    </div>
  );
}

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0) return <ArrowUpRight size={17} aria-hidden="true" />;
  if (delta < 0) return <ArrowDownRight size={17} aria-hidden="true" />;
  return <ArrowRight size={17} aria-hidden="true" />;
}

type ComparisonMetric = "spending" | "income" | "saldo";
type ComparisonTone = "positive" | "negative" | "neutral";

function comparisonTone(metric: ComparisonMetric, delta: number): ComparisonTone {
  if (delta === 0) return "neutral";
  if (metric === "spending") return delta > 0 ? "negative" : "positive";
  return delta > 0 ? "positive" : "negative";
}

function comparisonChangeLabel(metric: ComparisonMetric, delta: number) {
  if (delta === 0) return "unverändert";
  const direction = delta > 0 ? "gestiegen" : "gesunken";
  if (metric === "spending") return `Ausgaben ${direction}`;
  if (metric === "income") return `Einnahmen ${direction}`;
  return `Saldo ${direction}`;
}

function formatSignedMoney(amountCents: number) {
  return `${amountCents > 0 ? "+" : ""}${formatMoney(amountCents)}`;
}

function formatPercentDelta(delta: number, base: number) {
  if (delta === 0) return "0 %";
  if (base === 0) return delta > 0 ? "neu im Zeitraum" : "weggefallen";
  const value = (delta / base) * 100;
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} %`;
}

function percentWidth(value: number, max: number) {
  const percent = Math.max(6, Math.min(100, (Math.abs(value) / Math.max(1, max)) * 100));
  return `${percent}%`;
}

function AnalysisFocusPanel({
  title,
  income,
  spending,
  saldo,
  netConsumption,
  entryCount
}: {
  title: string;
  income: number;
  spending: number;
  saldo: number;
  netConsumption: number;
  entryCount: number;
}) {
  return (
    <div className="analysis-focus-panel">
      <div>
        <span className="eyebrow">Fokus</span>
        <h3>{title}</h3>
        <p className="muted">{entryCount} Einträge im aktiven Zeitraum</p>
      </div>
      <div className="analysis-focus-stats">
        <div><span>Saldo</span><strong className={saldo < 0 ? "negative" : "positive"}>{formatMoney(saldo)}</strong></div>
        <div><span>Einnahmen</span><strong>{formatMoney(income)}</strong></div>
        <div><span>Ausgaben</span><strong>{formatMoney(spending)}</strong></div>
        <div><span>Netto-Verbrauch</span><strong>{formatMoney(netConsumption)}</strong></div>
      </div>
    </div>
  );
}

function BudgetPressureList({ rows, showBudget }: { rows: ReturnType<typeof buildCategoryRows>; showBudget: boolean }) {
  const visibleRows = (showBudget
    ? [...rows].sort((a, b) => {
      const aPressure = a.budget > 0 ? a.budgetUsage : a.spending > 0 ? 1 : 0;
      const bPressure = b.budget > 0 ? b.budgetUsage : b.spending > 0 ? 1 : 0;
      return bPressure - aPressure || b.spending - a.spending;
    })
    : rows.filter((row) => row.spending > 0).sort((a, b) => b.spending - a.spending)).slice(0, 4);
  if (visibleRows.length === 0) return <EmptyState>Noch keine Budgetdaten im Zeitraum.</EmptyState>;
  return (
    <div className="finance-budget-list">
      {visibleRows.map((row) => (
        <div className="finance-budget-row" key={row.name}>
          <span className="finance-budget-icon" style={{ background: row.color }} aria-hidden="true"><CategoryIcon icon={row.icon} size={17} /></span>
          <div>
            <strong>{row.name}</strong>
            <span>{showBudget ? row.budget > 0 ? `${row.budgetUsage.toFixed(0)}% vom Budget genutzt` : "Ohne Budget" : `${row.percent.toFixed(0)}% der Ausgaben`}</span>
            <div className="bar-wrap budget-bar"><span style={{ width: `${Math.max(4, showBudget ? row.budgetUsage : row.percent)}%`, background: row.color }} /></div>
          </div>
          <div className="amount-column">
            <strong>{formatMoney(row.spending)}</strong>
            {showBudget ? <BudgetHint row={row} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysisRow({
  href,
  row,
  showBudget,
  percent,
  meta
}: {
  href?: string;
  row: {
    name: string;
    color: string;
    icon?: string | null;
    budget: number;
    remaining: number;
    budgetUsage: number;
    income: number;
    spending: number;
    saldo: number;
    amount: number;
  };
  showBudget: boolean;
  percent?: number;
  meta?: string;
}) {
  const content = (
    <>
      <span className="analysis-row-icon" style={{ background: row.color }} aria-hidden="true"><CategoryIcon icon={row.icon} size={17} /></span>
      <div className="analysis-row-copy">
        <strong>{row.name}</strong>
        <span className="muted">{meta ?? (showBudget ? row.budget > 0 ? `Budget ${formatMoney(row.budget)}` : "Ohne Budget" : row.income > 0 && row.spending <= 0 ? "Einnahme" : typeof percent === "number" ? `${percent.toFixed(0)}% Anteil` : "Ausgaben")}</span>
      </div>
      <div className="bar-stack">
        {typeof percent === "number" ? <div className="bar-wrap"><span style={{ width: `${percent}%`, background: row.color }} /></div> : null}
        {showBudget ? <div className="bar-wrap budget-bar"><span style={{ width: `${row.budgetUsage}%`, background: row.color }} /></div> : null}
      </div>
      <div className="amount-column compact-amount">
        <AnalysisAmount row={row} />
        {showBudget ? <BudgetHint row={row} /> : null}
      </div>
      {href ? <span className="analysis-row-chevron" aria-hidden="true">›</span> : null}
    </>
  );

  if (!href) return <div className="analysis-row">{content}</div>;
  return <a className="analysis-row analysis-link-row" href={href}>{content}</a>;
}

function DuplicateReviewPanel({ groups, returnTo }: { groups: DuplicateGroup[]; returnTo: string }) {
  if (groups.length === 0) return null;
  const duplicateEntryCount = groups.reduce((sum, group) => sum + group.entries.length, 0);
  return (
    <div className="duplicate-action-row">
      <div>
        <strong>Duplikatprüfung</strong>
        <span>{groups.length} Gruppen mit {duplicateEntryCount} ähnlichen Einträgen</span>
      </div>
      <ActionModal title="Duplikate prüfen" trigger="Duplikate" modalId="ausgaben-duplikate" triggerClassName="button duplicate-action-button" wide>
        <div className="duplicate-review">
          <div className="duplicate-review-head">
            <div>
              <h3>Mögliche Duplikate</h3>
              <p className="muted">Prüfe die Gruppen und wähle jeweils den Eintrag, der erhalten bleiben soll. Die übrigen Einträge der Gruppe werden gelöscht.</p>
            </div>
          </div>
          <div className="duplicate-group-list">
            {groups.map((group) => (
              <div className="duplicate-group" key={group.key}>
                <div className="duplicate-group-title">
                  <strong>{formatDate(group.entries[0].date)} · {formatMoney(group.entries[0].amountCents, group.entries[0].currency)}</strong>
                  <span>{group.entries.length} ähnliche Einträge</span>
                </div>
                <div className="duplicate-choice-list">
                  {group.entries.map((entry) => (
                    <form action={mergeDuplicateExpenses} className="duplicate-choice" key={entry.id}>
                      <input type="hidden" name="keepExpenseId" value={entry.id} />
                      <input type="hidden" name="returnTo" value={withModalParam(returnTo, "ausgaben-duplikate")} />
                      {group.entries.map((duplicate) => <input type="hidden" name="expenseId" value={duplicate.id} key={duplicate.id} />)}
                      <div>
                        <strong>{entry.description || "Ohne Beschreibung"}</strong>
                        <span>{[entry.store, entry.paymentMethod, entry.category?.name, entry.label?.name].filter(Boolean).join(" · ") || "Keine Details"}</span>
                        <small>Erfasst am {formatDate(entry.createdAt)}</small>
                      </div>
                      <button className="button secondary" type="submit">Diesen behalten</button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ActionModal>
    </div>
  );
}

function withModalParam(href: string, modalId: string) {
  const [pathWithQuery, hash = ""] = href.split("#", 2);
  const [pathname, query = ""] = pathWithQuery.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("modal", modalId);
  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

function PeriodNavigator({
  params,
  range,
  currentMonthKey
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  range: ReturnType<typeof getRange>;
  currentMonthKey: string;
}) {
  const currentYear = range.mode === "year" ? range.from.getFullYear() : Number((range.mode === "month" ? range.key : currentMonthKey).slice(0, 4));
  const monthKey = range.mode === "month" ? range.key : `${currentYear}-${currentMonthKey.slice(5)}`;
  const isYear = range.mode === "year";
  const previousHref = isYear ? buildYearNavigationHref(params, currentYear, -1) : buildMonthNavigationHref(params, monthKey, -1);
  const nextHref = isYear ? buildYearNavigationHref(params, currentYear, 1) : buildMonthNavigationHref(params, monthKey, 1);
  const title = isYear ? String(currentYear) : range.mode === "custom" ? "Freier Zeitraum" : formatMonthKeyLabel(monthKey);
  const detail = isYear ? "Jahresansicht" : range.mode === "custom" ? `${formatDate(range.from)} bis ${formatDate(range.to)}` : "Monatsansicht";
  const todayHref = isYear
    ? buildPeriodHref(params, { year: String(Number(currentMonthKey.slice(0, 4))), month: undefined })
    : buildPeriodHref(params, { month: currentMonthKey, year: undefined });
  const todayLabel = isYear ? "Aktuelles Jahr anzeigen" : "Aktuellen Monat anzeigen";

  return (
    <div className="period-nav-main">
      <PeriodNavLink className="period-nav-button" href={previousHref} aria-label={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"} title={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"}>
        <span aria-hidden="true">&lsaquo;</span>
      </PeriodNavLink>
      <div className="period-nav-current" aria-live="polite">
        <span>{detail}</span>
        <strong>{title}</strong>
      </div>
      <PeriodNavLink className="period-nav-button" href={nextHref} aria-label={isYear ? "Nächstes Jahr" : "Nächster Monat"} title={isYear ? "Nächstes Jahr" : "Nächster Monat"}>
        <span aria-hidden="true">&rsaquo;</span>
      </PeriodNavLink>
      <PeriodNavLink className="period-nav-button period-current-icon" href={todayHref} aria-label={todayLabel} title={todayLabel}>
        <CalendarCheck size={18} aria-hidden="true" />
      </PeriodNavLink>
      <div className="period-mode-toggle" role="list" aria-label="Zeitraum-Modus">
        <PeriodNavLink role="listitem" className={!isYear && range.mode !== "custom" ? "active" : ""} href={buildPeriodHref(params, { month: monthKey })}>Monat</PeriodNavLink>
        <PeriodNavLink role="listitem" className={isYear ? "active" : ""} href={buildPeriodHref(params, { year: String(currentYear) })}>Jahr</PeriodNavLink>
      </div>
    </div>
  );
}

function MiniTable({ rows, showBudget = false }: { rows: PeriodRow[]; showBudget?: boolean }) {
  if (rows.length === 0) return <EmptyState>Noch keine Daten vorhanden.</EmptyState>;
  return (
    <div className="mini-table">
      <div className="mini-table-head">
        <span>Zeitraum</span><span>Einnahmen</span><span>Ausgaben</span>{showBudget ? <span>Budget</span> : null}<span>Saldo</span>
      </div>
      {rows.map((row) => (
        <div className="mini-table-row" key={row.label}>
          <span>{row.label}</span>
          <span>{formatMoney(row.income)}</span>
          <span>{formatMoney(row.spending)}</span>
          {showBudget ? <span>{formatMoney(row.budget)}</span> : null}
          <strong className={row.saldo < 0 ? "negative" : "positive"}>{formatMoney(row.saldo)}</strong>
        </div>
      ))}
    </div>
  );
}

function BudgetHint({ row }: { row: { budget: number; remaining: number } }) {
  if (row.budget <= 0) return <small className="muted">ohne Budget</small>;
  return <small className={row.remaining < 0 ? "negative" : "positive"}>{row.remaining < 0 ? "netto drüber " : "netto frei "}{formatMoney(Math.abs(row.remaining))}</small>;
}

function AnalysisAmount({ row }: { row: { amount: number; income: number; spending: number; saldo: number } }) {
  if (row.income <= 0) return <strong>{formatMoney(row.amount)}</strong>;
  return (
    <>
      <strong className={row.saldo < 0 ? "negative" : "positive"}>{formatMoney(row.saldo)}</strong>
      <small className="muted">Einnahmen {formatMoney(row.income)} · Ausgaben {formatMoney(row.spending)}</small>
    </>
  );
}

function labelRowMeta(row: { budget: number; neverUsed?: boolean }) {
  const budget = row.budget > 0 ? `Budget ${formatMoney(row.budget)}` : "Ohne Budget";
  return row.neverUsed ? `Noch nicht genutzt · ${budget}` : budget;
}

function FilterHiddenFields({
  params,
  includeSearch = false,
  includePeriod = false,
  includeFacets = true,
  includeSort = true,
  includeView = true
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  includeSearch?: boolean;
  includePeriod?: boolean;
  includeFacets?: boolean;
  includeSort?: boolean;
  includeView?: boolean;
}) {
  return (
    <>
      {includeSearch && params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {includeSort && params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
      {includeView && params.view ? <input type="hidden" name="view" value={params.view} /> : null}
      {includePeriod && params.year ? <input type="hidden" name="year" value={params.year} /> : null}
      {includePeriod && params.month ? <input type="hidden" name="month" value={params.month} /> : null}
      {includePeriod && params.from ? <input type="hidden" name="from" value={params.from} /> : null}
      {includePeriod && params.to ? <input type="hidden" name="to" value={params.to} /> : null}
      {includeFacets ? normalizeList(params.label).map((value) => <input type="hidden" name="label" value={value} key={`label-${value}`} />) : null}
      {includeFacets ? normalizeList(params.category).map((value) => <input type="hidden" name="category" value={value} key={`category-${value}`} />) : null}
      {includeFacets && params.kind ? <input type="hidden" name="kind" value={params.kind} /> : null}
      {includeFacets ? normalizeList(params.paymentMethod).map((value) => <input type="hidden" name="paymentMethod" value={value} key={`payment-${value}`} />) : null}
      {includeFacets ? normalizeList(params.source).map((value) => <input type="hidden" name="source" value={value} key={`source-${value}`} />) : null}
    </>
  );
}

function ChartHiddenFields({ params }: { params: Awaited<ExpensesPageProps["searchParams"]> }) {
  return (
    <>
      {params.chartDimension ? <input type="hidden" name="chartDimension" value={params.chartDimension} /> : null}
      {params.chartMetric ? <input type="hidden" name="chartMetric" value={params.chartMetric} /> : null}
      {params.chartTop ? <input type="hidden" name="chartTop" value={params.chartTop} /> : null}
      {params.chartMonths ? <input type="hidden" name="chartMonths" value={params.chartMonths} /> : null}
    </>
  );
}

function ComparisonRangeForm({
  params,
  comparisonRange,
  years
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  comparisonRange: ReturnType<typeof getComparisonRange>;
  years: number[];
}) {
  const yearOptions = [...new Set([comparisonRange.year, ...years])].sort((a, b) => b - a);
  const modeLinks = [
    { mode: "month" as const, label: "Monat", href: buildExpensesHref(params, { view: "compare", compareMode: "month", compareMonth: comparisonRange.month, compareYear: undefined, compareFrom: undefined, compareTo: undefined }) },
    { mode: "year" as const, label: "Jahr", href: buildExpensesHref(params, { view: "compare", compareMode: "year", compareMonth: undefined, compareYear: String(comparisonRange.year), compareFrom: undefined, compareTo: undefined }) },
    { mode: "custom" as const, label: "Zeitraum", href: buildExpensesHref(params, { view: "compare", compareMode: "custom", compareMonth: undefined, compareYear: undefined, compareFrom: dateInputKey(comparisonRange.from), compareTo: dateInputKey(comparisonRange.to) }) }
  ];

  return (
    <div className="comparison-picker">
      <div className="comparison-mode-toggle" aria-label="Vergleichsart">
        {modeLinks.map((item) => (
          <Link className={comparisonRange.mode === item.mode ? "active" : ""} href={item.href} key={item.mode}>
            {item.label}
          </Link>
        ))}
      </div>
      <form className="inline-form compare-form comparison-picker-form">
        <FilterHiddenFields params={params} includePeriod includeFacets includeSearch includeSort includeView={false} />
        <input type="hidden" name="view" value="compare" />
        <input type="hidden" name="compareMode" value={comparisonRange.mode} />
        <ChartHiddenFields params={params} />
        <div className="comparison-picker-fields">
          {comparisonRange.mode === "month" ? (
            <label>
              Vergleichsmonat
              <input name="compareMonth" type="month" defaultValue={comparisonRange.month} />
            </label>
          ) : null}
          {comparisonRange.mode === "year" ? (
            <label>
              Vergleichsjahr
              <select name="compareYear" defaultValue={String(comparisonRange.year)}>
                {yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
            </label>
          ) : null}
          {comparisonRange.mode === "custom" ? (
            <>
              <label>
                Vergleich von
                <input name="compareFrom" type="date" defaultValue={dateInputKey(comparisonRange.from)} />
              </label>
              <label>
                Vergleich bis
                <input name="compareTo" type="date" defaultValue={dateInputKey(comparisonRange.to)} />
              </label>
            </>
          ) : null}
        </div>
        <button className="button secondary" type="submit">Vergleichen</button>
      </form>
    </div>
  );
}

function ExpenseSortControl({
  params,
  sortKey
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  sortKey: ReturnType<typeof getExpenseSortKey>;
}) {
  const activeOption = expenseSortOptions.find((option) => option.value === sortKey) ?? expenseSortOptions[0];
  return (
    <div className="expense-sort-control">
      <span title={`Sortiert: ${activeOption.label}`}>{activeOption.label}</span>
      <ActionModal
        title="Einträge sortieren"
        trigger={<ListFilter aria-hidden="true" size={18} />}
        triggerLabel="Einträge sortieren"
        modalId="ausgaben-sortierung"
        triggerClassName="button secondary expense-sort-trigger"
        panelClassName="expense-sort-sheet"
        sheetSize="compact"
      >
        <form className="form compact expense-sort-modal-form">
          <FilterHiddenFields params={params} includeSearch includePeriod includeSort={false} />
          <label>
            Sortieren nach
            <select name="sort" defaultValue={sortKey}>
              {expenseSortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className="button" type="submit">Übernehmen</button>
        </form>
      </ActionModal>
    </div>
  );
}

function countActiveFinanceFilters(params: Awaited<ExpensesPageProps["searchParams"]>) {
  return [
    normalizeList(params.category).length > 0,
    normalizeList(params.label).length > 0,
    Boolean(params.kind),
    normalizeList(params.paymentMethod).length > 0,
    normalizeList(params.source).length > 0
  ].filter(Boolean).length;
}

function buildAnalyticsScopeEntries(entries: ExpenseLike[], params: Awaited<ExpensesPageProps["searchParams"]>, query: string) {
  const selectedLabels = normalizeList(params.label);
  const selectedCategories = normalizeList(params.category);
  const facetEntries = entries
    .filter((entry) => selectedLabels.length === 0 || (entry.labelId !== null && selectedLabels.includes(entry.labelId)))
    .filter((entry) => selectedCategories.length === 0 || (entry.categoryId !== null && selectedCategories.includes(entry.categoryId)));
  return filterExpenseFacets(facetEntries, params)
    .filter((entry) => !query || matchesExpenseSearch(entry, query, { documents: [] }));
}

function getRange(params: Awaited<ExpensesPageProps["searchParams"]>, currentMonthKey: string, expenses: ExpenseLike[]) {
  const fallbackMonth = monthRange(currentMonthKey) ?? monthRange(getMonthKey())!;
  if (params.from || params.to) {
    return {
      mode: "custom" as const,
      from: params.from ? new Date(params.from) : fallbackMonth.from,
      to: params.to ? endOfDay(new Date(params.to)) : fallbackMonth.to
    };
  }
  if (params.month) {
    const range = monthRange(params.month);
    if (range) return { mode: "month" as const, key: params.month, ...range };
  }
  if (params.year) {
    const year = Number(params.year);
    return { mode: "year" as const, from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
  }
  if (hasFacetFilter(params)) {
    return allExpenseRange(expenses) ?? { mode: "month" as const, key: currentMonthKey, ...fallbackMonth };
  }
  return { mode: "month" as const, key: currentMonthKey, ...fallbackMonth };
}

function getComparisonRange(params: Awaited<ExpensesPageProps["searchParams"]>, currentRange: ReturnType<typeof getRange>) {
  const fallback = previousSameLengthRange(currentRange);
  const fallbackMode = currentRange.mode === "year" ? "year" : "month";
  const mode = params.compareMode === "year" || params.compareMode === "custom" || params.compareMode === "month" ? params.compareMode : fallbackMode;
  const fallbackMonth = currentRange.mode === "month" && "key" in currentRange ? buildPreviousMonthKey(currentRange.key) : buildMonthKeyFromDate(fallback.from, 0);
  const fallbackYear = currentRange.mode === "year" ? currentRange.from.getFullYear() - 1 : fallback.from.getFullYear();

  if (mode === "year") {
    const parsedYear = params.compareYear ? Number(params.compareYear) : fallbackYear;
    const year = Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 2200 ? parsedYear : fallbackYear;
    return { mode: "year" as const, year, month: `${year}-01`, from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
  }

  if (mode === "custom") {
    const from = params.compareFrom ? new Date(params.compareFrom) : fallback.from;
    const to = params.compareTo ? endOfDay(new Date(params.compareTo)) : fallback.to;
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      return { mode: "custom" as const, year: from.getFullYear(), month: buildMonthKeyFromDate(from, 0), from, to };
    }
    return { mode: "custom" as const, year: fallback.from.getFullYear(), month: fallbackMonth, from: fallback.from, to: fallback.to };
  }

  const monthKey = params.compareMonth && monthRange(params.compareMonth) ? params.compareMonth : fallbackMonth;
  const range = monthRange(monthKey) ?? monthRange(fallbackMonth) ?? fallback;
  return { mode: "month" as const, year: Number(monthKey.slice(0, 4)), month: monthKey, from: range.from, to: range.to };
}

function previousSameLengthRange(range: ReturnType<typeof getRange>) {
  const from = new Date(range.from);
  const to = new Date(range.to);
  if (range.mode === "month" && "key" in range) {
    const previousMonth = monthRange(buildPreviousMonthKey(range.key));
    if (previousMonth) return { mode: "month" as const, ...previousMonth };
  }
  if (range.mode === "year") {
    const year = range.from.getFullYear() - 1;
    return { mode: "year" as const, from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
  }
  const lengthMs = Math.max(24 * 60 * 60 * 1000, to.getTime() - from.getTime());
  const compareTo = endOfDay(new Date(from.getTime() - 24 * 60 * 60 * 1000));
  const compareFrom = new Date(compareTo.getTime() - lengthMs);
  compareFrom.setHours(0, 0, 0, 0);
  return { mode: "custom" as const, from: compareFrom, to: compareTo };
}

function buildPreviousMonthKey(monthKey: string) {
  return buildMonthKeyFromDate(new Date(`${monthKey}-01T00:00:00`), -1);
}

function buildMonthKeyFromDate(date: Date, monthOffset: number) {
  const shifted = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function buildComparableEntries(entries: ExpenseLike[], params: Awaited<ExpensesPageProps["searchParams"]>, range: { from: Date; to: Date }, query: string) {
  const selectedLabels = normalizeList(params.label);
  const selectedCategories = normalizeList(params.category);
  const rangeEntries = entries
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => selectedLabels.length === 0 || (entry.labelId !== null && selectedLabels.includes(entry.labelId)))
    .filter((entry) => selectedCategories.length === 0 || (entry.categoryId !== null && selectedCategories.includes(entry.categoryId)));
  return filterExpenseFacets(rangeEntries, params)
    .filter((entry) => !query || matchesExpenseSearch(entry, query, { documents: [] }));
}

const entryPageSize = 100;

function getInitialEntryLimit(mode: ReturnType<typeof getRange>["mode"]) {
  return mode === "month" ? 100 : entryPageSize;
}

function buildExpenseListLoadUrl(params: Awaited<ExpensesPageProps["searchParams"]>) {
  const search = new URLSearchParams();
  for (const key of ["from", "to", "year", "month", "label", "category", "kind", "q", "sort"] as const) {
    const value = params[key];
    if (value) search.set(key, value);
  }
  for (const value of normalizeList(params.paymentMethod)) search.append("paymentMethod", value);
  for (const value of normalizeList(params.source)) search.append("source", value);
  const query = search.toString();
  return query ? `/api/expenses/list?${query}` : "/api/expenses/list";
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

function allExpenseRange(expenses: ExpenseLike[]) {
  if (expenses.length === 0) return null;
  const times = expenses.map((expense) => new Date(expense.date).getTime());
  return {
    mode: "all" as const,
    from: new Date(Math.min(...times)),
    to: endOfDay(new Date(Math.max(...times)))
  };
}

function hasFacetFilter(params: Awaited<ExpensesPageProps["searchParams"]>) {
  return Boolean(params.q || normalizeList(params.category).length > 0 || normalizeList(params.label).length > 0 || params.kind || normalizeList(params.paymentMethod).length > 0 || normalizeList(params.source).length > 0);
}

function isInRange(date: Date, from: Date, to: Date) {
  const value = new Date(date).getTime();
  return value >= from.getTime() && value <= to.getTime();
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

function formatEuroInput(amountCents: number) {
  if (amountCents === 0) return "";
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

function buildPeriodComparison(currentEntries: ExpenseLike[], compareEntries: ExpenseLike[], categories: CategoryLike[], currentRange: ReturnType<typeof getRange>, compareRange: { from: Date; to: Date }) {
  const names = new Set(categories.map((category) => category.name));
  for (const entry of [...currentEntries, ...compareEntries]) {
    if (entry.kind === "EXPENSE") names.add(entry.category?.name ?? "Ohne Kategorie");
  }
  const rows = [...names].map((name) => {
    const currentSpending = sumCategoryEntries(currentEntries, name);
    const compareSpending = sumCategoryEntries(compareEntries, name);
    return {
      name,
      currentSpending,
      compareSpending,
      delta: currentSpending - compareSpending
    };
  }).filter((row) => row.currentSpending > 0 || row.compareSpending > 0)
    .sort((a, b) => Math.max(b.currentSpending, b.compareSpending) - Math.max(a.currentSpending, a.compareSpending));
  const currentIncome = sumByKind(currentEntries, "INCOME");
  const currentSpending = sumByKind(currentEntries, "EXPENSE");
  const compareIncome = sumByKind(compareEntries, "INCOME");
  const compareSpending = sumByKind(compareEntries, "EXPENSE");
  return {
    current: {
      label: rangeLabel(currentRange),
      income: currentIncome,
      spending: currentSpending,
      saldo: currentIncome - currentSpending
    },
    compare: {
      label: rangeLabel(compareRange),
      income: compareIncome,
      spending: compareSpending,
      saldo: compareIncome - compareSpending
    },
    delta: {
      income: currentIncome - compareIncome,
      spending: currentSpending - compareSpending,
      saldo: (currentIncome - currentSpending) - (compareIncome - compareSpending)
    },
    rows
  };
}

function sumCategoryEntries(entries: ExpenseLike[], categoryName: string) {
  return entries
    .filter((entry) => entry.kind === "EXPENSE")
    .filter((entry) => (entry.category?.name ?? "Ohne Kategorie") === categoryName)
    .reduce((sum, entry) => sum + entry.amountCents, 0);
}

function rangeLabel(range: { from: Date; to: Date }) {
  return `${formatDate(range.from)} bis ${formatDate(range.to)}`;
}

function dateInputKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

type FinanceInsight = {
  label: string;
  title: string;
  detail: string;
  href: string;
  tone: "positive" | "warning" | "neutral";
};

function buildAnalysisInsights({
  params,
  selectedEntries,
  allEntries,
  categoryRows,
  labelRows,
  range,
  monthBudget,
  netConsumption,
  showBudget,
  currentMonthKey
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  selectedEntries: ExpenseLike[];
  allEntries: ExpenseLike[];
  categoryRows: ReturnType<typeof buildCategoryRows>;
  labelRows: ReturnType<typeof buildLabelRows>;
  range: ReturnType<typeof getRange>;
  monthBudget: number;
  netConsumption: number;
  showBudget: boolean;
  currentMonthKey: string;
}): FinanceInsight[] {
  const insights: FinanceInsight[] = [];
  const topCategory = categoryRows.find((row) => row.spending > 0);
  const mixedLabel = labelRows.find((row) => row.income > 0 && row.spending > 0);

  if (showBudget && monthBudget > 0) {
    const remaining = monthBudget - netConsumption;
    insights.push({
      label: "Budget",
      title: remaining < 0 ? "Netto-Budget überschritten" : "Netto-Budget im Blick",
      detail: remaining < 0 ? `${formatMoney(Math.abs(remaining))} über Budget.` : `${formatMoney(remaining)} noch frei.`,
      href: buildExpensesHref(params, { view: "categories" }),
      tone: remaining < 0 ? "warning" : "positive"
    });
  }

  if (topCategory) {
    insights.push({
      label: "Treiber",
      title: `${topCategory.name} prägt den Zeitraum`,
      detail: `${formatMoney(topCategory.spending)} Ausgaben · ${topCategory.percent.toFixed(0)}% Anteil.`,
      href: topCategory.id ? buildExpensesHref(params, { category: topCategory.id, label: undefined, view: "categories" }) : buildExpensesHref(params, { view: "categories" }),
      tone: "neutral"
    });

    const benchmark = previousSpendingBenchmark(allEntries, topCategory.name, range);
    if (benchmark && topCategory.spending > benchmark.average * 1.25) {
      insights.push({
        label: "Auffällig",
        title: `${topCategory.name} liegt höher als üblich`,
        detail: `Aktuell ${formatMoney(topCategory.spending)} · Vergleich ${benchmark.label}.`,
        href: topCategory.id ? buildExpensesHref(params, { category: topCategory.id, label: undefined, view: "categories" }) : buildExpensesHref(params, { view: "categories" }),
        tone: "warning"
      });
    }
  }

  if (range.mode === "month" && range.key === currentMonthKey && selectedEntries.length > 0) {
    const today = new Date();
    const elapsedDays = Math.max(1, Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()));
    const daysInMonth = new Date(range.from.getFullYear(), range.from.getMonth() + 1, 0).getDate();
    const projected = Math.round((netConsumption / elapsedDays) * daysInMonth);
    insights.push({
      label: "Prognose",
      title: `Monatsende ca. ${formatMoney(projected)}`,
      detail: `${formatMoney(netConsumption)} netto bisher, hochgerechnet auf ${daysInMonth} Tage.`,
      href: buildExpensesHref(params, { view: "categories" }),
      tone: showBudget && monthBudget > 0 && projected > monthBudget ? "warning" : "neutral"
    });
  }

  if (mixedLabel) {
    insights.push({
      label: "Rückerstattung",
      title: `${mixedLabel.name} enthält Einnahmen und Ausgaben`,
      detail: `Saldo ${formatMoney(mixedLabel.saldo)} · netto ${formatMoney(mixedLabel.netConsumption)} verbraucht.`,
      href: mixedLabel.id ? buildExpensesHref(params, { label: mixedLabel.id, category: undefined, view: "categories" }) : buildExpensesHref(params, { view: "categories" }),
      tone: mixedLabel.saldo >= 0 ? "positive" : "neutral"
    });
  }

  if (insights.length === 0) {
    insights.push({
      label: "Status",
      title: "Noch keine Auffälligkeiten",
      detail: "Sobald genug Einträge vorhanden sind, erscheinen hier Vergleichs- und Budgethinweise.",
      href: buildExpensesHref(params, { view: "entries" }),
      tone: "neutral"
    });
  }

  return insights.slice(0, 4);
}

function previousSpendingBenchmark(entries: ExpenseLike[], categoryName: string, range: ReturnType<typeof getRange>) {
  if (range.mode === "month") {
    const periods = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(range.from.getFullYear(), range.from.getMonth() - index - 1, 1);
      const from = new Date(date.getFullYear(), date.getMonth(), 1);
      const to = endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
      return { from, to };
    });
    const result = averagePeriodSpending(entries, categoryName, periods, 3);
    if (!result) return null;
    return { average: result.average, label: `Ø ${formatMoney(result.average)} pro Monat aus ${result.count} Vormonaten` };
  }

  if (range.mode === "year") {
    const year = range.from.getFullYear();
    const periods = Array.from({ length: 4 }, (_, index) => {
      const previousYear = year - index - 1;
      return { from: new Date(previousYear, 0, 1), to: endOfDay(new Date(previousYear, 11, 31)) };
    });
    const result = averagePeriodSpending(entries, categoryName, periods, 2);
    if (!result) return null;
    return { average: result.average, label: `Ø ${formatMoney(result.average)} pro Jahr aus ${result.count} Vorjahren` };
  }

  if (range.mode === "custom") {
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / dayMs) + 1);
    const periods = Array.from({ length: 3 }, (_, index) => {
      const to = endOfDay(new Date(range.from.getTime() - (index * days + 1) * dayMs));
      const from = new Date(to.getTime() - (days - 1) * dayMs);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    });
    const result = averagePeriodSpending(entries, categoryName, periods, 2);
    if (!result) return null;
    return { average: result.average, label: `Ø ${formatMoney(result.average)} je gleich langem Vorzeitraum aus ${result.count} Vergleichen` };
  }

  return null;
}

function averagePeriodSpending(entries: ExpenseLike[], categoryName: string, periods: Array<{ from: Date; to: Date }>, minimumCount: number) {
  const totals = periods
    .map((period) => entries
      .filter((entry) => entry.kind === "EXPENSE")
      .filter((entry) => (entry.category?.name ?? "Ohne Kategorie") === categoryName)
      .filter((entry) => isInRange(entry.date, period.from, period.to))
      .reduce((sum, entry) => sum + entry.amountCents, 0))
    .filter((total) => total > 0);
  if (totals.length < minimumCount) return null;
  return {
    average: Math.round(totals.reduce((sum, total) => sum + total, 0) / totals.length),
    count: totals.length
  };
}

function getExpenseView(value: unknown): FinanceView {
  if (value === "entries") return "entries";
  if (value === "categories" || value === "analysis" || value === "periods") return "categories";
  if (value === "budgets") return "budgets";
  if (value === "labels") return "labels";
  if (value === "compare") return "compare";
  return "overview";
}

function isFinanceAnalysisView(view: FinanceView) {
  return view === "categories" || view === "budgets" || view === "labels" || view === "compare";
}

function getChartDimension(value: unknown): ExpenseChartDimension {
  return value === "label" ? "label" : "category";
}

function getChartMetric(value: unknown): ExpenseChartMetric {
  if (value === "income" || value === "saldo" || value === "net") return value;
  return "spending";
}

function getChartTop(value: unknown) {
  const top = Number(value);
  return top === 3 || top === 5 || top === 8 ? top : 5;
}

function getChartMonths(value: unknown) {
  const months = Number(value);
  return months === 12 ? 12 : 6;
}

function formatCompactMoney(amountCents: number) {
  const amount = Math.abs(amountCents);
  if (amount >= 100000) return `${Math.round(amountCents / 100000) / 10}k`;
  return formatMoney(amountCents).replace(",00", "");
}

function chartMetricLabel(metric: ExpenseChartMetric) {
  if (metric === "income") return "Einnahmen";
  if (metric === "saldo") return "Saldo";
  if (metric === "net") return "Netto-Verbrauch";
  return "Ausgaben";
}

function getAnalysisFocusTitle(params: Awaited<ExpensesPageProps["searchParams"]>, categories: CategoryLike[], labels: LabelLike[]) {
  const categoryNames = normalizeList(params.category).map((id) => categories.find((category) => category.id === id)?.name).filter((name): name is string => Boolean(name));
  if (categoryNames.length) return `Kategorie: ${categoryNames.join(", ")}`;
  const labelNames = normalizeList(params.label).map((id) => labels.find((label) => label.id === id)?.name).filter((name): name is string => Boolean(name));
  if (labelNames.length) return `Label: ${labelNames.join(", ")}`;
  return null;
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function buildDuplicateGroups(entries: ExpenseLike[]): DuplicateGroup[] {
  const groups = new Map<string, ExpenseLike[]>();
  for (const entry of entries) {
    const key = duplicateKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.entries()]
    .map(([key, groupEntries]) => ({ key, entries: groupEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }))
    .filter((group) => group.entries.length > 1)
    .sort((a, b) => b.entries.length - a.entries.length || new Date(b.entries[0].date).getTime() - new Date(a.entries[0].date).getTime());
}

function buildDuplicateCounts(groups: DuplicateGroup[]) {
  const counts: Record<string, number> = {};
  for (const group of groups) {
    for (const entry of group.entries) {
      counts[entry.id] = group.entries.length;
    }
  }
  return counts;
}

function duplicateKey(entry: ExpenseLike) {
  return [
    entry.kind,
    entry.amountCents,
    dateKey(entry.date),
    normalizeDuplicateText(entry.description),
    normalizeDuplicateText(entry.store),
    normalizeDuplicateText(entry.paymentMethod),
    entry.categoryId ?? "",
    entry.labelId ?? "",
    entry.contractId ?? "",
    entry.recurringTransactionId ?? "",
    entry.fuelEntryId ?? ""
  ].join("|");
}

function normalizeDuplicateText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

function dateKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function buildActiveFilterChips(
  params: Awaited<ExpensesPageProps["searchParams"]>,
  categories: CategoryLike[],
  labels: LabelLike[],
  range: ReturnType<typeof getRange>
) {
  const chips: { label: string; clear: Partial<Awaited<ExpensesPageProps["searchParams"]>> }[] = [];
  if (params.q) chips.push({ label: `Suche: ${params.q}`, clear: { q: undefined } });
  for (const categoryId of normalizeList(params.category)) {
    chips.push({
      label: `Kategorie: ${categories.find((category) => category.id === categoryId)?.name ?? "Gewählt"}`,
      clear: { category: normalizeList(params.category).filter((item) => item !== categoryId) }
    });
  }
  for (const labelId of normalizeList(params.label)) {
    chips.push({
      label: `Label: ${labels.find((label) => label.id === labelId)?.name ?? "Gewählt"}`,
      clear: { label: normalizeList(params.label).filter((item) => item !== labelId) }
    });
  }
  if (params.kind === "expense") chips.push({ label: "Art: Ausgaben", clear: { kind: undefined } });
  if (params.kind === "income") chips.push({ label: "Art: Einnahmen", clear: { kind: undefined } });
  for (const method of normalizeList(params.paymentMethod)) {
    chips.push({
      label: `Zahlungsart: ${method}`,
      clear: { paymentMethod: normalizeList(params.paymentMethod).filter((item) => item !== method) }
    });
  }
  for (const source of normalizeList(params.source)) {
    chips.push({
      label: `Quelle: ${sourceLabel(source as ReturnType<typeof expenseSource>)}`,
      clear: { source: normalizeList(params.source).filter((item) => item !== source) }
    });
  }
  if (range.mode === "custom") {
    chips.push({ label: `Zeitraum: ${formatDate(range.from)} - ${formatDate(range.to)}`, clear: { from: undefined, to: undefined } });
  }
  return chips;
}

function buildPaymentMethodOptions(expenses: ExpenseLike[]) {
  return [...new Set(expenses.map((expense) => expense.paymentMethod).filter(isUsefulFilterValue))]
    .sort((a, b) => a.localeCompare(b, "de-DE"));
}

function isUsefulFilterValue(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("de-DE");
  return Boolean(normalized) && normalized !== "nicht angegeben";
}


type ExpenseLike = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
type CategoryLike = Awaited<ReturnType<typeof getVisibleCategories>>[number];
type LabelLike = Awaited<ReturnType<typeof getExpenseLabels>>[number];

