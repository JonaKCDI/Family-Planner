import { mergeDuplicateExpenses } from "@/lib/actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import {
  buildCategoryRows,
  buildCategoryTrendChart,
  buildDonutSegments,
  buildLabelRows,
  buildPeriodRows,
  sumByKind,
  type CategoryTrendChart,
  type DonutSegment,
  type ExpenseChartDimension,
  type PeriodRow
} from "@/lib/expense-analytics";
import { toExpenseDocumentItem, toExpenseListItem } from "@/lib/expense-list";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { expenseSortOptions, getExpenseSortKey, sortExpenseEntries } from "@/lib/expense-sorting";
import { formatDate, formatMoney } from "@/lib/format";
import { buildExpensesHref, buildMonthNavigationHref, buildPeriodHref, buildYearNavigationHref, getCanonicalExpensesHref, getMonthKey, getRawExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { formatMonthKeyLabel } from "@/lib/month-options";
import { getDocumentsForLinkedEntities, getExpenseLabels, getRecurringTransactions, getVisibleCategories, getVisibleContracts, getVisibleExpenses } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { ListFilter, Search } from "lucide-react";
import { ExpenseSetupPanel, RecurringTransactionsPanel } from "@/components/expense-setup-panel";
import { ExpenseEntryList } from "@/components/expense-entry-list";
import { ExpenseFilterForm } from "@/components/expense-filter-form";
import { PeriodNavLink } from "@/components/period-nav-link";
import { EmptyState } from "@/components/ui";

type ExpensesPageProps = {
  searchParams: Promise<ExpenseFilterParams>;
};

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
  const rangeFilteredEntries = expenses
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => !params.label || entry.labelId === params.label)
    .filter((entry) => !params.category || entry.categoryId === params.category);
  const searchableDocuments = query
    ? await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", rangeFilteredEntries.map((entry) => entry.id))
    : [];
  const searchableDocumentsByExpense = groupBy(searchableDocuments, (document) => document.linkedEntityId ?? "");
  const selectedEntries = rangeFilteredEntries
    .filter((entry) => !query || matchesExpenseSearch(entry, query, { documents: searchableDocumentsByExpense[entry.id] ?? [] }));
  const view = getExpenseView(params.view);
  const sortKey = getExpenseSortKey(params.sort);
  const sortedEntries = view === "entries" ? sortExpenseEntries(selectedEntries, sortKey) : [];
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
  const monthlyRows = buildPeriodRows(selectedEntries, categories, "month");
  const yearlyRows = buildPeriodRows(expenses, categories, "year");
  const chartDimension = getChartDimension(params.chartDimension);
  const analysisRows = chartDimension === "label" ? labelRows : categoryRows;
  const donutSegments = buildDonutSegments(analysisRows);
  const trendMonths = getTrendMonths(params.trendMonths);
  const trendCategoryId = getTrendCategoryId(params.trendCategory, categoryRows, categories);
  const trendChart = buildCategoryTrendChart(expenses, categories, {
    categoryId: trendCategoryId,
    months: trendMonths,
    endDate: range.to
  });
  const comparison = view === "overview" || params.compareA || params.compareB
    ? buildYearComparison(expenses, categories, Number(params.compareA ?? years[0]), Number(params.compareB ?? years[1] ?? years[0]))
    : { yearA: Number(params.compareA ?? years[0]), yearB: Number(params.compareB ?? years[1] ?? years[0]), rows: [] };
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
  const initialEntryLimit = view === "entries" ? getInitialEntryLimit(range.mode) : 0;
  const initialEntries = view === "entries" ? sortedEntries.slice(0, initialEntryLimit) : [];
  const initialEntryIds = new Set(initialEntries.map((expense) => expense.id));
  const documents = view === "entries" ? (query
    ? searchableDocuments.filter((document) => document.linkedEntityId ? initialEntryIds.has(document.linkedEntityId) : false)
    : await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", initialEntries.map((expense) => expense.id))) : [];
  const documentsByExpense = groupBy(documents.map(toExpenseDocumentItem), (document) => document.linkedEntityId ?? "");
  const expenseListEntries = initialEntries.map(toExpenseListItem);
  const expenseListLoadUrl = buildExpenseListLoadUrl(params);
  const returnTo = getRawExpensesHref(params);
  const exportYear = range.from.getFullYear();
  const setupReturnTo = `${returnTo}${returnTo.includes("?") ? "&" : "?"}modal=ausgaben-setup`;
  const focusTitle = getAnalysisFocusTitle(params, categories, allLabels);

  return (
    <>
      <div className="page-head app-page-header finance-page-header">
        <h1>Finanzen</h1>
        <details className="compact-search" open={Boolean(query)}>
          <summary aria-label="Finanzen durchsuchen" title="Suchen"><Search aria-hidden="true" size={19} /></summary>
          <form className="search-bar">
            <FilterHiddenFields params={params} includePeriod />
            <label>
              <span>Ausgaben durchsuchen</span>
              <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Beschreibung, Kategorie, Label, Vertrag ..." autoFocus={Boolean(query)} />
            </label>
            <button className="button secondary search-submit-button" type="submit" aria-label="Suchen" title="Suchen">
              <Search aria-hidden="true" size={17} />
            </button>
            {query ? <a className="button secondary" href={buildExpensesHref(params, { q: undefined })}>Suche schließen</a> : null}
          </form>
        </details>
        <ActionModal title="Finanzen filtern" trigger={<ListFilter size={19} aria-hidden="true" />} triggerLabel="Finanzen filtern" modalId="ausgaben-filter" triggerClassName="icon-button page-filter-button">
          <ExpenseFilterForm params={params} categories={categories} labels={labels} years={years} currentMonthKey={currentMonthKey} />
        </ActionModal>
      </div>

      <section className="filter-system" aria-label="Ausgabenfilter">
        <div className="period-navigator">
          <PeriodNavigator params={params} range={range} currentMonthKey={currentMonthKey} />
          <div className="period-tools">
            <PeriodNavLink className="button period-primary-action" href={buildPeriodHref(params, { month: currentMonthKey })}>Aktuell</PeriodNavLink>
          </div>
        </div>
        <div className="overview-actions secondary-filter-actions expense-secondary-actions">
          <ActionModal title="Serien verwalten" trigger="Serien" modalId="ausgaben-serien" wide>
            <RecurringTransactionsPanel recurringTransactions={recurringTransactions} categories={categories} labels={labels} />
          </ActionModal>
          <ActionModal title="Ausgaben-Setup" trigger="Setup" modalId="ausgaben-setup" wide>
            <ExpenseSetupPanel
              exportYear={exportYear}
              categories={categories}
              labels={labels}
              allLabels={allLabels}
              recurringTransactions={recurringTransactions}
              returnTo={setupReturnTo}
            />
          </ActionModal>
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

      <section className="stats">
        <div className="stat"><span>Einnahmen</span><strong>{formatMoney(income)}</strong></div>
        <div className="stat"><span>Ausgaben</span><strong>{formatMoney(spending)}</strong></div>
        <div className="stat"><span>Saldo</span><strong className={saldo < 0 ? "negative" : "positive"}>{formatMoney(saldo)}</strong></div>
        <div className="stat">
          <span>{showBudget ? "Budget netto übrig" : "Budget"}</span>
          {showBudget ? (
            <>
              <strong className={monthBudget - netConsumption < 0 ? "negative" : "positive"}>{formatMoney(monthBudget - netConsumption)}</strong>
              <small>{formatMoney(netConsumption)} netto verbraucht</small>
            </>
          ) : (
            <>
              <strong>Nur Monatsansicht</strong>
              <small>Jahresansichten zeigen keine Budgetreste</small>
            </>
          )}
        </div>
      </section>

      <nav className="section-switcher" id="finanzansichten" aria-label="Finanzbereiche">
        <Link className={view === "entries" ? "active" : ""} href={financeViewHref(params, "entries")} scroll={false}>Einträge</Link>
        <Link className={view === "overview" ? "active" : ""} href={financeViewHref(params, "overview")} scroll={false}>Auswertung</Link>
      </nav>

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
              categories={categories.map((category) => ({ id: category.id, name: category.name, color: category.color }))}
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

      {view === "overview" ? (
      <section className="analysis-tabs spacing-top" id="auswertung">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2 className="section-title">Auswertung</h2>
              <p className="muted">{focusTitle ? "Fokussierte Auswertung." : "Kategorien, Labels, Zeitverlauf und Jahresvergleich an einem Ort."}</p>
            </div>
            <div className="overview-actions">
              {params.category ? <a className="button secondary" href={buildExpensesHref(params, { category: undefined, view: "overview" })}>Kategorie lösen</a> : null}
              {params.label ? <a className="button secondary" href={buildExpensesHref(params, { label: undefined, view: "overview" })}>Label lösen</a> : null}
            </div>
          </div>
          {focusTitle ? (
            <AnalysisFocusPanel title={focusTitle} income={income} spending={spending} saldo={saldo} netConsumption={netConsumption} entryCount={selectedEntries.length} />
          ) : null}
          <ExpenseChartControls params={params} dimension={chartDimension} />
          <div className="analysis-overview">
            <div className="pie-card">
              <div>
                <h3>{chartDimension === "label" ? "Labels" : "Kategorien"}</h3>
                <p className="muted">Anteile im gewählten Zeitraum.</p>
              </div>
              <DonutChart segments={donutSegments} />
              <div className="pie-legend modern-chart-legend">
                {donutSegments.length === 0 ? <span><i />Keine Ausgaben im Zeitraum</span> : null}
                {donutSegments.map((segment) => (
                  <a href={analysisLegendHref(params, chartDimension, analysisRows, segment)} className="chart-legend-row" key={segment.name}>
                    <span><i style={{ background: segment.color }} />{segment.name}</span>
                    <strong>{formatMoney(segment.value)} · {segment.percent.toFixed(0)}%</strong>
                  </a>
                ))}
              </div>
            </div>
            <div className="list">
              <div className="analysis-module-head">
                <div>
                  <h3>Rangliste</h3>
                  <p className="muted">Tippe eine Zeile für gefilterte Einträge an.</p>
                </div>
              </div>
              {analysisRows.length === 0 ? <EmptyState>Noch keine Ausgaben im Zeitraum.</EmptyState> : null}
              {analysisRows.map((row) => (
                <AnalysisRow
                  href={analysisRowHref(params, chartDimension, row.id)}
                  key={row.name}
                  row={row}
                  showBudget={showBudget}
                  percent={"percent" in row ? row.percent : undefined}
                  meta={chartDimension === "label" ? labelRowMeta(row) : undefined}
                />
              ))}
            </div>
          </div>

          <div className="analysis-divider" />
          <div className="insight-list" aria-label="Analysehinweise">
            {insights.map((insight) => (
              <div className={`insight-card ${insight.tone}`} key={insight.title}>
                <span>{insight.label}</span>
                <strong>{insight.title}</strong>
                <small>{insight.detail}</small>
              </div>
            ))}
          </div>
          <div className="analysis-divider" />
          <div className="analysis-chart-card">
            <div className="section-head compact-section-head">
              <div>
                <h3>Zeitdiagramm</h3>
                <p className="muted">{trendChart.categoryName} über {trendMonths} Monate.</p>
              </div>
            </div>
            <TrendControls params={params} categories={categoryRows} selectedCategoryId={trendChart.categoryId} months={trendMonths} />
            <CategoryTrendChartView chart={trendChart} params={params} />
          </div>
          <div className="analysis-divider" />
          <div className="analysis-grid period-analysis-grid">
            <div><h3>Monatsübersicht</h3><MiniTable rows={monthlyRows} showBudget /></div>
            <div><h3>Jahresübersicht</h3><MiniTable rows={yearlyRows} /></div>
          </div>
          <div className="analysis-divider" />
          <div className="section-head compact-section-head">
            <div>
              <h3>Manueller Jahresvergleich</h3>
              <p className="muted">Vergleicht die Ausgaben je Kategorie für zwei Jahre.</p>
            </div>
          </div>
          <form className="inline-form compare-form">
            <FilterHiddenFields params={params} includePeriod includeFacets includeSearch includeSort includeView={false} />
            <input type="hidden" name="view" value="overview" />
            <ChartHiddenFields params={params} />
            <label>
              Jahr A
              <select name="compareA" defaultValue={comparison.yearA}>
                {years.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
            </label>
            <label>
              Jahr B
              <select name="compareB" defaultValue={comparison.yearB}>
                {years.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
            </label>
            <button className="button secondary" type="submit">Vergleichen</button>
          </form>
          <YearComparisonTable comparison={comparison} />
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

function financeViewHref(params: Awaited<ExpensesPageProps["searchParams"]>, view: "entries" | "overview") {
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

function ExpenseChartControls({
  params,
  dimension
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  dimension: ExpenseChartDimension;
}) {
  return (
    <form className="analysis-control-bar">
      <FilterHiddenFields params={params} includeSearch includePeriod includeFacets includeSort includeView={false} />
      <input type="hidden" name="view" value="overview" />
      <label className="compact-select">
        Ansicht
        <select name="chartDimension" defaultValue={dimension}>
          <option value="category">Kategorien</option>
          <option value="label">Labels</option>
        </select>
      </label>
      <button className="button secondary" type="submit">Anzeigen</button>
    </form>
  );
}

function TrendControls({
  params,
  categories,
  selectedCategoryId,
  months
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  categories: ReturnType<typeof buildCategoryRows>;
  selectedCategoryId?: string;
  months: number;
}) {
  const options = categories.filter((category) => category.id);
  if (options.length === 0) return null;
  return (
    <form className="analysis-control-bar trend-control-bar">
      <FilterHiddenFields params={params} includeSearch includePeriod includeSort includeView={false} />
      <input type="hidden" name="view" value="overview" />
      <input type="hidden" name="chartDimension" value="category" />
      <label className="compact-select">
        Kategorie
        <select name="trendCategory" defaultValue={selectedCategoryId ?? ""}>
          {options.map((category) => (
            <option value={category.id} key={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label className="compact-select">
        Zeitraum
        <select name="trendMonths" defaultValue={months}>
          <option value="3">3 Monate</option>
          <option value="6">6 Monate</option>
          <option value="12">12 Monate</option>
        </select>
      </label>
      <button className="button secondary" type="submit">Aktualisieren</button>
    </form>
  );
}

function CategoryTrendChartView({
  chart,
  params
}: {
  chart: CategoryTrendChart;
  params: Awaited<ExpensesPageProps["searchParams"]>;
}) {
  if (chart.points.length === 0) {
    return <EmptyState>Noch keine Daten für dieses Zeitdiagramm.</EmptyState>;
  }
  return (
    <div className="category-trend-bars" role="img" aria-label={`Ausgaben für ${chart.categoryName}`}>
      {chart.points.map((point) => {
        const height = Math.max(4, (point.spending / chart.maxValue) * 100);
        return (
          <a className="category-trend-bar" href={buildExpensesHref(params, { month: point.period, year: undefined, from: undefined, to: undefined, category: chart.categoryId, label: undefined, view: "entries" })} key={point.period}>
            <span className="category-trend-value">{point.spending > 0 ? formatCompactMoney(point.spending) : "-"}</span>
            <span className="category-trend-track" aria-hidden="true">
              <i style={{ height: `${height}%`, background: chart.color }} />
            </span>
            <strong>{formatMonthShort(point.period)}</strong>
            {point.income > 0 ? <small>{formatMoney(point.income)} Einnahmen</small> : null}
          </a>
        );
      })}
    </div>
  );
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
  if (!id) return buildExpensesHref(params, { view: "overview" });
  return dimension === "label"
    ? buildExpensesHref(params, { label: id, category: undefined, view: "entries" })
    : buildExpensesHref(params, { category: id, label: undefined, view: "entries" });
}

function formatMonthShort(period: string) {
  const [year, month] = period.split("-");
  return `${month}.${year.slice(2)}`;
}

function YearComparisonTable({ comparison }: { comparison: ReturnType<typeof buildYearComparison> }) {
  if (comparison.rows.length === 0) return <EmptyState>Noch keine Vergleichsdaten vorhanden.</EmptyState>;
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col">Kategorie</th>
            <th scope="col">{comparison.yearA}</th>
            <th scope="col">{comparison.yearB}</th>
            <th scope="col">Differenz</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{formatMoney(row.amountA)}</td>
              <td>{formatMoney(row.amountB)}</td>
              <td className={row.delta > 0 ? "negative" : "positive"}>{row.delta > 0 ? "+" : ""}{formatMoney(row.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
      <div>
        <strong>{row.name}</strong>
        <span className="muted">{meta ?? (showBudget ? row.budget > 0 ? `Budget ${formatMoney(row.budget)}` : "Ohne Budget" : "Ausgabenanteil")}</span>
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
      <strong className={row.saldo < 0 ? "negative" : "positive"}>Saldo {formatMoney(row.saldo)}</strong>
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
      {includeFacets && params.label ? <input type="hidden" name="label" value={params.label} /> : null}
      {includeFacets && params.category ? <input type="hidden" name="category" value={params.category} /> : null}
    </>
  );
}

function ChartHiddenFields({ params }: { params: Awaited<ExpensesPageProps["searchParams"]> }) {
  return (
    <>
      {params.chartDimension ? <input type="hidden" name="chartDimension" value={params.chartDimension} /> : null}
      {params.trendCategory ? <input type="hidden" name="trendCategory" value={params.trendCategory} /> : null}
      {params.trendMonths ? <input type="hidden" name="trendMonths" value={params.trendMonths} /> : null}
    </>
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

const entryPageSize = 100;

function getInitialEntryLimit(mode: ReturnType<typeof getRange>["mode"]) {
  return mode === "month" ? 100 : entryPageSize;
}

function buildExpenseListLoadUrl(params: Awaited<ExpensesPageProps["searchParams"]>) {
  const search = new URLSearchParams();
  for (const key of ["from", "to", "year", "month", "label", "category", "q", "sort"] as const) {
    const value = params[key];
    if (value) search.set(key, value);
  }
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
  return Boolean(params.q || params.category || params.label);
}

function isInRange(date: Date, from: Date, to: Date) {
  const value = new Date(date).getTime();
  return value >= from.getTime() && value <= to.getTime();
}

function buildYearComparison(entries: ExpenseLike[], categories: CategoryLike[], yearA: number, yearB: number) {
  const names = new Set(categories.map((category) => category.name));
  for (const entry of entries) {
    if (entry.kind === "EXPENSE") names.add(entry.category?.name ?? "Ohne Kategorie");
  }
  const rows = [...names].map((name) => {
    const amountA = sumCategoryYear(entries, name, yearA);
    const amountB = sumCategoryYear(entries, name, yearB);
    return { name, amountA, amountB, delta: amountB - amountA };
  }).filter((row) => row.amountA > 0 || row.amountB > 0).sort((a, b) => Math.max(b.amountA, b.amountB) - Math.max(a.amountA, a.amountB));
  return { yearA, yearB, rows };
}

function sumCategoryYear(entries: ExpenseLike[], categoryName: string, year: number) {
  return entries
    .filter((entry) => entry.kind === "EXPENSE")
    .filter((entry) => new Date(entry.date).getFullYear() === year)
    .filter((entry) => (entry.category?.name ?? "Ohne Kategorie") === categoryName)
    .reduce((sum, entry) => sum + entry.amountCents, 0);
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

    const previousAverage = averagePreviousMonthlySpending(allEntries, topCategory.name, range.from);
    if (previousAverage > 0 && topCategory.spending > previousAverage * 1.25) {
      insights.push({
        label: "Auffällig",
        title: `${topCategory.name} liegt höher als üblich`,
        detail: `${formatMoney(topCategory.spending)} statt Ø ${formatMoney(previousAverage)} in den letzten Monaten.`,
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
      href: buildExpensesHref(params, { view: "periods" }),
      tone: showBudget && monthBudget > 0 && projected > monthBudget ? "warning" : "neutral"
    });
  }

  if (mixedLabel) {
    insights.push({
      label: "Rückerstattung",
      title: `${mixedLabel.name} enthält Einnahmen und Ausgaben`,
      detail: `Saldo ${formatMoney(mixedLabel.saldo)} · netto ${formatMoney(mixedLabel.netConsumption)} verbraucht.`,
      href: mixedLabel.id ? buildExpensesHref(params, { label: mixedLabel.id, category: undefined, view: "labels" }) : buildExpensesHref(params, { view: "labels" }),
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

function averagePreviousMonthlySpending(entries: ExpenseLike[], categoryName: string, before: Date) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(before.getFullYear(), before.getMonth() - index - 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const totals = months.map((month) => entries
    .filter((entry) => entry.kind === "EXPENSE")
    .filter((entry) => (entry.category?.name ?? "Ohne Kategorie") === categoryName)
    .filter((entry) => {
      const date = new Date(entry.date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === month;
    })
    .reduce((sum, entry) => sum + entry.amountCents, 0));
  const monthsWithData = totals.filter((total) => total > 0);
  if (monthsWithData.length < 3) return 0;
  return Math.round(monthsWithData.reduce((sum, total) => sum + total, 0) / monthsWithData.length);
}

function getExpenseView(value: unknown): "entries" | "overview" {
  if (value === "overview" || value === "categories" || value === "labels" || value === "periods" || value === "analysis") return "overview";
  return "entries";
}

function getChartDimension(value: unknown): ExpenseChartDimension {
  return value === "label" ? "label" : "category";
}

function getTrendMonths(value: unknown) {
  const months = Number(value);
  return months === 3 || months === 6 || months === 12 ? months : 6;
}

function getTrendCategoryId(value: unknown, rows: ReturnType<typeof buildCategoryRows>, categories: CategoryLike[]) {
  const requested = String(value ?? "").trim();
  if (requested && rows.some((row) => row.id === requested)) return requested;
  return rows.find((row) => row.id && row.spending > 0)?.id ?? categories[0]?.id;
}

function formatCompactMoney(amountCents: number) {
  const amount = Math.abs(amountCents);
  if (amount >= 100000) return `${Math.round(amountCents / 100000) / 10}k`;
  return formatMoney(amountCents).replace(",00", "");
}

function getAnalysisFocusTitle(params: Awaited<ExpensesPageProps["searchParams"]>, categories: CategoryLike[], labels: LabelLike[]) {
  const categoryName = params.category ? categories.find((category) => category.id === params.category)?.name : null;
  if (categoryName) return `Kategorie: ${categoryName}`;
  const labelName = params.label ? labels.find((label) => label.id === params.label)?.name : null;
  if (labelName) return `Label: ${labelName}`;
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
  if (params.category) {
    chips.push({
      label: `Kategorie: ${categories.find((category) => category.id === params.category)?.name ?? "Gewählt"}`,
      clear: { category: undefined }
    });
  }
  if (params.label) {
    chips.push({
      label: `Label: ${labels.find((label) => label.id === params.label)?.name ?? "Gewählt"}`,
      clear: { label: undefined }
    });
  }
  if (range.mode === "custom") {
    chips.push({ label: `Zeitraum: ${formatDate(range.from)} - ${formatDate(range.to)}`, clear: { from: undefined, to: undefined } });
  }
  return chips;
}


type ExpenseLike = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
type CategoryLike = Awaited<ReturnType<typeof getVisibleCategories>>[number];
type LabelLike = Awaited<ReturnType<typeof getExpenseLabels>>[number];

