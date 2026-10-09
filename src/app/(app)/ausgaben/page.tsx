import { FinanceAnalysisRow } from "@/components/finance-analysis-row";
import { getExpenseRange as getRange, explicitExpensePeriod } from "@/lib/expense-range";
import { filterExpenseAssignments } from "@/lib/expense-filters";
import { FamilyFinancePage } from "@/components/family-finance-page";
import { FinanceAreaIndicator } from "@/components/finance-area-switch";
import { mergeDuplicateExpenses } from "@/lib/actions";
import Link from "@/components/finance-link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import {
  buildCategoryRows,
  buildLabelRows,
  buildPeriodRows,
  budgetCadenceLabel,
  recentLabelRows,
  sumByKind,
  type PeriodRow
} from "@/lib/expense-analytics";
import { toExpenseDocumentItem, toExpenseListItem } from "@/lib/expense-list";
import { matchesExpenseSearch } from "@/lib/expense-search";
import { expenseSortOptions, getExpenseSortKey, sortExpenseEntries } from "@/lib/expense-sorting";
import { formatDate, formatMoney } from "@/lib/format";
import { buildExpensesHref, buildMonthNavigationHref, buildPeriodHref, buildYearNavigationHref, getCanonicalExpensesHref, getMonthKey, getRawExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { expenseSource, filterExpenseFacets, normalizeList, sourceLabel } from "@/lib/expense-filters";
import { formatMonthKeyLabel } from "@/lib/month-options";
import { getVisibleDocumentRoots, getDocumentsForLinkedEntities, getExpenseLabels, getVisibleCategories, getVisibleContracts, getVisibleExpenses } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BanknoteArrowUp, CalendarCheck, ListFilter, ReceiptText, Scale, WalletCards } from "lucide-react";
import { ExpenseEntryList } from "@/components/expense-entry-list";
import { FinanceToolbar } from "@/components/finance-toolbar";
import { FinanceTransitionMarker } from "@/components/finance-transition-marker";
import { CategoryIcon } from "@/components/category-icon";
import { PeriodNavLink } from "@/components/period-nav-link";
import { EmptyState, PageHeader } from "@/components/ui";
import { DesktopDetail, DesktopFacts, DesktopWorkspace, desktopSelectedRecord } from "@/components/desktop-workspace";
import { DesktopFinanceAnalysisList } from "@/components/desktop-finance-analysis-list";
import { FinanceDetailAnalysis } from "@/components/finance-detail-analysis";
import { CategoryDistributionChart } from "@/components/category-distribution-chart";

type ExpensesPageProps = {
  searchParams: Promise<ExpenseFilterParams>;
};

type FinanceView = "overview" | "entries" | "categories" | "budgets" | "labels" | "compare";

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  if (params.bereich === "familie") return <FamilyFinancePage params={params} />;
  const canonicalHref = getCanonicalExpensesHref(params);
  if (canonicalHref !== getRawExpensesHref(params)) redirect(canonicalHref);
  await ensureDueContractExpenses(session.family.id, session.user.id);
  const [expenses, categories, labels, allLabels, contracts] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getExpenseLabels(session.family.id, session.user.id, { includeArchived: true }),
    getVisibleContracts(session.family.id, session.user.id)
  ]);
  const documentRoots = (await getVisibleDocumentRoots(session.family.id, session.user.id, session.role)).map(({ id, name }) => ({ id, name }));
  const query = normalizeSearch(params.q);
  const currentMonthKey = getMonthKey();
  const currentYear = Number(currentMonthKey.slice(0, 4));
  const years = [...new Set([currentYear, ...expenses.map((entry) => new Date(entry.date).getFullYear())])].sort((a, b) => b - a);
  const range = getRange(params, currentMonthKey, expenses);
  const rangeFilteredEntries = filterExpenseAssignments(expenses, params)
    .filter((entry) => isInRange(entry.date, range.from, range.to));
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
  const showBudget = range.mode !== "all";
  const needsCategoryRows = view === "overview" || view === "categories" || view === "budgets";
  const needsLabelRows = view === "overview" || view === "labels" || view === "budgets";
  const budgetHistoryEntries = needsLabelRows ? expenses.filter((entry) => entry.currency === (params.currency || "EUR")) : [];
  const categoryRows = needsCategoryRows ? buildCategoryRows(selectedEntries, categories, spending, range) : [];
  const desktopMixedCurrencies = !params.currency && new Set(selectedEntries.map((entry) => entry.currency)).size > 1;
  const labelRows = needsLabelRows ? buildLabelRows(selectedEntries, labels, range, budgetHistoryEntries) : [];
  const overviewLabelRows = view === "overview" ? recentLabelRows(selectedEntries, labelRows) : [];
  const categoryAnalysisRows = categoryRows.filter((row) => row.spending > 0 || row.income > 0);
  const labelAnalysisRows = labelRows.filter((row) => row.spending > 0 || row.income > 0 || row.budget > 0);
  const desktopCategoryId = categoryAnalysisRows.some((row) => (row.id ?? "unassigned") === params.selected) ? params.selected! : (categoryAnalysisRows[0]?.id ?? "unassigned");
  const desktopLabelId = labelAnalysisRows.some((row) => (row.id ?? "unassigned") === params.selected) ? params.selected! : (labelAnalysisRows[0]?.id ?? "unassigned");
  const monthlyRows = view === "budgets" ? buildPeriodRows(selectedEntries, categories, "month") : [];
  const analysisParams = explicitExpensePeriod(params, range);
  const comparisonRange = view === "compare" ? getComparisonRange(params, range) : null;
  const comparisonEntries = comparisonRange ? buildComparableEntries(expenses, params, comparisonRange, query) : [];
  const comparison = comparisonRange ? buildPeriodComparison(selectedEntries, comparisonEntries, categories, range, comparisonRange) : null;
  const activeFilterChips = buildActiveFilterChips(params, categories, allLabels, range);
  const paymentMethods = buildPaymentMethodOptions(expenses);
  const activeFilterCount = countActiveFinanceFilters(params);
  const initialEntryLimit = view === "entries" ? getInitialEntryLimit(range.mode) : 0;
  const initialEntries = view === "entries" ? sortedEntries.slice(0, initialEntryLimit) : view === "overview" ? recentEntries : [];
  const desktopEntries = view === "overview" ? recentEntries : sortedEntries;
  const desktopSelectedExpense = desktopSelectedRecord(desktopEntries, params.selected ?? undefined);
  const initialEntryIds = new Set([...initialEntries.map((expense) => expense.id), ...(desktopSelectedExpense && (view === "overview" || view === "entries") ? [desktopSelectedExpense.id] : [])]);
  const shouldLoadEntryDocuments = view === "entries" || view === "overview";
  const documents = shouldLoadEntryDocuments ? (query
    ? searchableDocuments.filter((document) => document.linkedEntityId ? initialEntryIds.has(document.linkedEntityId) : false)
    : await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", [...initialEntryIds])) : [];
  const documentsByExpense = groupBy(documents.map(toExpenseDocumentItem), (document) => document.linkedEntityId ?? "");
  const expenseListEntries = initialEntries.map(toExpenseListItem);
  const expenseListLoadUrl = buildExpenseListLoadUrl(params);
  const returnTo = getRawExpensesHref(params);
  const monthBudget = showBudget ? categoryRows.reduce((sum, category) => sum + category.budget, 0) : 0;
  const budgetRemaining = monthBudget - netConsumption;
  const isAnalysisArea = isFinanceAnalysisView(view);
  const summaryMax = Math.max(income, spending, Math.abs(saldo), Math.abs(budgetRemaining), 1);
  const budgetUsageWidth = showBudget && monthBudget > 0 ? `${Math.max(4, Math.min(100, (netConsumption / monthBudget) * 100))}%` : "0%";
  const desktopEntryWorkspace = (view === "overview" || view === "entries") ? <DesktopWorkspace
    ariaLabel="Buchungen und Details"
    title={view === "overview" ? "Buchungen im Blick" : "Alle Buchungen"}
    description={`${formatCalendarBound(range.from)} bis ${formatCalendarBound(range.to)}`}
    controls={view === "entries" ? <>{selectedEntries.length > 0 && <ExpenseSortControl params={params} sortKey={sortKey} modalId="ausgaben-sortierung-desktop" />}<DuplicateReviewPanel groups={duplicateGroups} returnTo={returnTo} modalId="ausgaben-duplikate-desktop" /></> : null}
    rows={desktopEntries.map((entry) => ({ id: entry.id, title: entry.description || "Ohne Beschreibung", subtitle: `${formatDate(entry.date)} · ${entry.category?.name ?? "Ohne Kategorie"}`, meta: `${entry.kind === "INCOME" ? "+" : "−"}${formatMoney(entry.amountCents, entry.currency)}` }))}
    selectedId={desktopSelectedExpense?.id}
    pathname="/ausgaben"
    params={params}
    detail={desktopSelectedExpense ? <DesktopDetail title={desktopSelectedExpense.description || "Ohne Beschreibung"} eyebrow="Buchung" actions={<ExpenseEntryList
        initialEntries={[toExpenseListItem(desktopSelectedExpense)]}
        totalCount={1}
        duplicateCounts={{}}
        categories={categories.map((category) => ({ id: category.id, name: category.name, color: category.color, icon: category.icon }))}
        labels={labels.map((label) => ({ id: label.id, name: label.name, color: label.color }))}
        contracts={contracts.map((contract) => ({ id: contract.id, provider: contract.provider, contractType: contract.contractType }))}
        documentRoots={documentRoots}
        initialDocumentsByExpense={{ [desktopSelectedExpense.id]: documentsByExpense[desktopSelectedExpense.id] ?? [] }}
        loadUrl={expenseListLoadUrl}
        returnTo={returnTo}
        pageSize={1}
        inspectorTrigger
        modalIdPrefix="desktop-expense"
      />}>
      <strong className={desktopSelectedExpense.kind === "INCOME" ? "positive" : "negative"}>{desktopSelectedExpense.kind === "INCOME" ? "+" : "−"}{formatMoney(desktopSelectedExpense.amountCents, desktopSelectedExpense.currency)}</strong>
      <DesktopFacts items={[
        { label: "Datum", value: formatDate(desktopSelectedExpense.date) },
        { label: "Kategorie", value: desktopSelectedExpense.category?.name ?? "Ohne Kategorie" },
        { label: "Label", value: desktopSelectedExpense.label?.name ?? "Kein Label" },
        { label: "Geschäft", value: desktopSelectedExpense.store || "Nicht angegeben" },
        { label: "Zahlungsart", value: desktopSelectedExpense.paymentMethod || "Nicht angegeben" },
        { label: "Art", value: desktopSelectedExpense.kind === "INCOME" ? "Einnahme" : "Ausgabe" }
      ]} />
    </DesktopDetail> : null}
  /> : null;

  return (
    <>
      <FinanceTransitionMarker view={view} />
      <div className="task-page-head finance-page-head">
        <PageHeader title="Finanzen" suffix={<FinanceAreaIndicator />} />
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
        <Link href="/ausgaben/planung" scroll={false}>Prognose</Link>
      </nav>

      <section className="filter-system" aria-label="Ausgabenfilter">
        <div className="period-navigator">
          <PeriodNavigator params={params} range={range} currentMonthKey={currentMonthKey} />
        </div>
        <div className="overview-actions secondary-filter-actions expense-secondary-actions">
          <Link className="button secondary" href="/ausgaben/setup/serien">Serien</Link>
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
          <Link className={view === "labels" ? "active" : ""} href={financeViewHref(params, "labels")} scroll={false}>Labels</Link>
          <Link className={view === "budgets" ? "active" : ""} href={financeViewHref(params, "budgets")} scroll={false}>Budgets</Link>
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
        <section className={`finance-summary-panel${desktopMixedCurrencies ? " desktop-mixed-original-summary" : ""}`} aria-label="Finanzüberblick">
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
                <small>{formatMoney(netConsumption)} netto im gewählten Zeitraum</small>
                <div className="finance-summary-spark budget-spark" aria-hidden="true"><b style={{ width: budgetUsageWidth }} /></div>
              </>
            ) : (
              <>
                <strong>Zeitraum eingrenzen</strong>
                <small>Budgetvergleiche gibt es für Monat, Jahr und allzeit-Budgets</small>
                <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: "0%" }} /></div>
              </>
            )}
          </div>
        </section>
        {desktopMixedCurrencies && <DesktopCurrencySummary entries={selectedEntries} monthBudget={monthBudget} showBudget={showBudget} />}

        <section className={`panel finance-overview-snapshot${desktopMixedCurrencies ? " desktop-mixed-currencies" : ""}`}>
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Ausgaben nach Kategorie</h2>
              <p className="muted">Vorschau der wichtigsten Kategorien.</p>
            </div>
            <Link className="button secondary" href={financeViewHref(params, "categories")} scroll={false}>Alle</Link>
          </div>
          <BudgetPressureList rows={categoryRows} showBudget={showBudget} />
          <RecentLabelList rows={overviewLabelRows} />
          {desktopMixedCurrencies && <DesktopCurrencyCategoryList rows={categoryRows} entries={selectedEntries} showBudget={showBudget} />}
        </section>

        <section className="panel finance-overview-snapshot">
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Letzte Buchungen</h2>
              <p className="muted"><span className="mobile-only">{formatDate(range.from)} bis {formatDate(range.to)}</span><span className="desktop-only">{formatCalendarBound(range.from)} bis {formatCalendarBound(range.to)}</span></p>
            </div>
            <Link className="button secondary" href={financeViewHref(params, "entries")} scroll={false}>Alle</Link>
          </div>
          {initialEntries.length === 0 ? (
            <EmptyState>Noch keine Einträge im gewählten Zeitraum.</EmptyState>
          ) : (
            <ExpenseEntryList documentRoots={documentRoots}
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

        <div className="desktop-finance-workspace">{desktopEntryWorkspace}</div>
        <Link className="finance-inline-analysis-link" href={financeViewHref(params, "categories")} scroll={false}>Detaillierte Analyse ansehen <span aria-hidden="true">→</span></Link>
      </section>
      ) : null}

      {view === "entries" ? <div className="desktop-finance-workspace">{desktopEntryWorkspace}</div> : null}

      {view === "entries" ? (
      <section className="panel expense-section" id="eintraege">
        <div className="expense-section-summary">
          <div className="expense-section-heading">
            <h2 className="section-title">Einträge</h2>
            <p className="muted expense-section-meta"><span className="mobile-only">{formatDate(range.from)} bis {formatDate(range.to)}</span><span className="desktop-only">{formatCalendarBound(range.from)} bis {formatCalendarBound(range.to)}</span> · {selectedEntries.length} Einträge</p>
          </div>
          {selectedEntries.length > 0 ? <ExpenseSortControl params={params} sortKey={sortKey} /> : null}
        </div>
        {selectedEntries.length === 0 ? (
          <EmptyState>Noch keine Einträge im gewählten Zeitraum.</EmptyState>
        ) : (
          <>
            <DuplicateReviewPanel groups={duplicateGroups} returnTo={returnTo} />
            <ExpenseEntryList documentRoots={documentRoots}
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
          <div className="list finance-analysis-list">
            {categoryAnalysisRows.length === 0 ? <EmptyState>Noch keine Kategorien im Zeitraum.</EmptyState> : null}
            {categoryAnalysisRows.map((row) => (
              <FinanceAnalysisRow key={row.id ?? row.name} row={row} dimension="category" params={analysisParams} returnParams={params} currency={params.currency || "EUR"} percent={row.percent} />
            ))}
          </div>

          {categoryAnalysisRows.length > 0 && <><div className="desktop-analysis-overview-list"><DesktopFinanceAnalysisList params={params} dimension="category" selectedId={desktopCategoryId} workspaceView="categories" /></div><div className="desktop-analysis-inline"><FinanceDetailAnalysis params={params} dimension="category" id={desktopCategoryId} /></div></>}
        </section>
        <CategoryDistributionChart rows={categoryAnalysisRows} currency={params.currency || "EUR"} />
      </section>
      ) : null}

      {view === "budgets" ? (
      <section className="analysis-tabs spacing-top" id="budgets">
        <section className={`panel finance-category-page${desktopMixedCurrencies ? " desktop-mixed-currencies" : ""}`}>
          <div className="section-head compact-section-head">
            <div>
              <h2 className="section-title">Budgets</h2>
              <p className="muted">{showBudget ? "Budgets und Restbeträge für den gewählten Zeitraum." : "Für den Gesamtzeitraum werden nur Allzeit-Labelbudgets verglichen."}</p>
            </div>
          </div>
          <BudgetPressureList rows={categoryRows} showBudget={showBudget} />
          <LabelBudgetPressureList rows={labelRows} />
          {desktopMixedCurrencies && <DesktopCurrencyCategoryList rows={categoryRows} entries={selectedEntries} showBudget={showBudget} />}
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
              <p className="muted">Projekte und Erstattungen über Kategorien hinweg. Budgets zeigen den passenden Zeitraum.</p>
            </div>
          </div>
          <div className="list finance-analysis-list">
            {labelAnalysisRows.length === 0 ? <EmptyState>Noch keine Labels im Zeitraum.</EmptyState> : null}
            {labelAnalysisRows.map((row) => (
              <FinanceAnalysisRow key={row.id ?? row.name} row={row} dimension="label" params={analysisParams} returnParams={params} currency={params.currency || "EUR"} percent={spending > 0 ? row.spending / spending * 100 : 0} />
            ))}
          </div>
          {labelAnalysisRows.length > 0 && <><div className="desktop-analysis-overview-list"><DesktopFinanceAnalysisList params={params} dimension="label" selectedId={desktopLabelId} workspaceView="labels" /></div><div className="desktop-analysis-inline"><FinanceDetailAnalysis params={params} dimension="label" id={desktopLabelId} /></div></>}
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
          {comparisonRange ? <ComparisonRangeForm params={params} comparisonRange={comparisonRange} years={years} /> : null}
          {comparison ? <PeriodComparisonView comparison={comparison} /> : null}
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
  const largestCategory = Math.max(...comparison.rows.flatMap((row) => [Math.abs(row.currentSaldo), Math.abs(row.compareSaldo)]), 1);

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
        <div className="comparison-category-list" aria-label="Saldovergleich nach Kategorie">
          {comparison.rows.length === 0 ? <EmptyState>Keine Buchungen nach Kategorie in den Vergleichszeiträumen.</EmptyState> : null}
          {comparison.rows.map((row) => {
            const tone = comparisonTone("saldo", row.delta);
            return (
              <article className={`comparison-category-row tone-${tone}`} key={row.name}>
                <div className="comparison-category-main">
                  <strong>{row.name}</strong>
                  <span>{formatPercentDelta(row.delta, row.compareSaldo)}</span>
                </div>
                <div className="comparison-category-values">
                  <span>Aktueller Saldo <b>{formatMoney(row.currentSaldo)}</b></span>
                  <span>Vergleichssaldo <b>{formatMoney(row.compareSaldo)}</b></span>
                  <span className="comparison-category-delta"><TrendIcon delta={row.delta} /> <b>{formatSignedMoney(row.delta)}</b></span>
                </div>
                <ComparisonBars current={row.currentSaldo} compare={row.compareSaldo} max={largestCategory} />
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
  const value = (delta / Math.abs(base)) * 100;
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} %`;
}

function percentWidth(value: number, max: number) {
  const percent = Math.max(6, Math.min(100, (Math.abs(value) / Math.max(1, max)) * 100));
  return `${percent}%`;
}

function LabelBudgetPressureList({ rows }: { rows: ReturnType<typeof buildLabelRows> }) {
  const visibleRows = rows.filter((row) => row.budget > 0).sort((a, b) => b.budgetUsage - a.budgetUsage || b.budgetConsumption - a.budgetConsumption).slice(0, 6);
  if (visibleRows.length === 0) return null;
  return <section className="finance-label-budget-section" aria-label="Labelbudgets">
    <h3 className="section-title">Labelbudgets</h3>
    <div className="finance-budget-list">
      {visibleRows.map((row) => <div className="finance-budget-row" data-has-budget="true" key={row.id ?? row.name}>
        <span className="finance-budget-icon" style={{ background: row.color }} aria-hidden="true">•</span>
        <div><strong>{row.name}</strong><span>{budgetCadenceLabel(row.budgetPeriod)} · {row.budgetUsage.toFixed(0)} % genutzt</span><div className="bar-wrap budget-bar"><span style={{ width: `${Math.max(4, row.budgetUsage)}%`, background: row.color }} /></div></div>
        <div className="amount-column"><strong>{formatMoney(row.spending)}</strong><small className="muted">im Zeitraum</small><small className={row.remaining < 0 ? "negative" : "positive"}>{row.remaining < 0 ? `${formatMoney(Math.abs(row.remaining))} drüber` : `${formatMoney(row.remaining)} frei`}</small></div>
      </div>)}
    </div>
  </section>;
}

function RecentLabelList({ rows }: { rows: ReturnType<typeof buildLabelRows> }) {
  if (rows.length === 0) return null;
  return <section className="finance-label-budget-section" aria-label="Zuletzt verwendete Labels">
    <h3 className="section-title">Labels</h3>
    <div className="finance-budget-list">
      {rows.map((row) => <div className="finance-budget-row" data-has-budget={row.budget > 0 ? "true" : "false"} key={row.id ?? row.name}>
        <span className="finance-budget-icon" style={{ background: row.color }} aria-hidden="true">•</span>
        <div>
          <strong>{row.name}</strong>
          <span>{row.budget > 0 ? `${budgetCadenceLabel(row.budgetPeriod)} · ${row.budgetUsage.toFixed(0)} % genutzt` : "Ohne Budget"}</span>
          {row.budget > 0 ? <div className="bar-wrap budget-bar"><span style={{ width: `${Math.max(4, row.budgetUsage)}%`, background: row.color }} /></div> : null}
        </div>
        <div className="amount-column">
          <strong>{formatMoney(row.spending > 0 ? row.spending : row.income)}</strong>
          <small className="muted">{row.spending > 0 ? "Ausgaben im Zeitraum" : "Einnahmen im Zeitraum"}</small>
          {row.budget > 0 ? <small className={row.remaining < 0 ? "negative" : "positive"}>{row.remaining < 0 ? `${formatMoney(Math.abs(row.remaining))} drüber` : `${formatMoney(row.remaining)} frei`}</small> : null}
        </div>
      </div>)}
    </div>
  </section>;
}

function BudgetPressureList({ rows, showBudget }: { rows: ReturnType<typeof buildCategoryRows>; showBudget: boolean }) {
  const visibleRows = (showBudget
    ? [...rows].sort((a, b) => {
      const aPressure = a.budget > 0 ? a.budgetUsage : a.saldo !== 0 ? 1 : 0;
      const bPressure = b.budget > 0 ? b.budgetUsage : b.saldo !== 0 ? 1 : 0;
      return bPressure - aPressure || b.spending - a.spending;
    })
    : rows.filter((row) => row.spending > 0 || row.income > 0).sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))).slice(0, 4);
  if (visibleRows.length === 0) return <EmptyState>Noch keine Budgetdaten im Zeitraum.</EmptyState>;
  return (
    <div className="finance-budget-list">
      {visibleRows.map((row) => (
        <div className="finance-budget-row" data-has-budget={row.budget > 0 ? "true" : "false"} key={row.id ?? row.name}>
          <span className="finance-budget-icon" style={{ background: row.color }} aria-hidden="true"><CategoryIcon icon={row.icon} size={17} /></span>
          <div>
            <strong>{row.name}</strong>
            <span>{showBudget ? row.budget > 0 ? `${row.budgetUsage.toFixed(0)}% genutzt · ${formatMoney(row.budget)} im Zeitraum (${budgetCadenceLabel(row.budgetPeriod)})` : "Ohne Budget" : `${row.percent.toFixed(0)}% des Saldos`}</span>
            {(!showBudget || row.budget > 0) && <div className="bar-wrap budget-bar"><span style={{ width: `${Math.max(4, showBudget ? row.budgetUsage : row.percent)}%`, background: row.color }} /></div>}
          </div>
          <div className="amount-column">
            <strong className={row.saldo < 0 ? "negative" : "positive"}>{formatMoney(row.saldo)}</strong>
            {showBudget ? <BudgetHint row={row} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopCurrencyCategoryList({ rows, entries, showBudget }: { rows: ReturnType<typeof buildCategoryRows>; entries: ExpenseLike[]; showBudget: boolean }) {
  return <div className="finance-budget-list desktop-category-budget-list" aria-label="Kategorien nach Währung">
    <p className="muted">Beträge nach Währung getrennt. Budgets gelten für EUR.</p>
    {rows.filter((row) => row.spending > 0 || row.income > 0 || (showBudget && row.budget > 0)).slice(0, 8).map((row) => {
      const categoryEntries = entries.filter((entry) => (entry.categoryId ?? null) === (row.id ?? null));
      const currencies = [...new Set(categoryEntries.map((entry) => entry.currency))].sort();
      const eurSpending = categoryEntries.filter((entry) => entry.currency === "EUR" && entry.kind === "EXPENSE").reduce((sum, entry) => sum + entry.amountCents, 0);
      const eurIncome = categoryEntries.filter((entry) => entry.currency === "EUR" && entry.kind === "INCOME").reduce((sum, entry) => sum + entry.amountCents, 0);
      const eurUsage = row.budget > 0 ? Math.min(100, Math.max(0, (eurSpending - eurIncome) / row.budget * 100)) : 0;
      return <div className="finance-budget-row" key={row.id ?? "unassigned"}>
        <span className="finance-budget-icon" style={{ background: row.color }} aria-hidden="true"><CategoryIcon icon={row.icon} size={17} /></span>
        <div><strong>{row.name}</strong><span>{row.budget > 0 ? `${eurUsage.toFixed(0)}% vom EUR-Budget genutzt · ${budgetCadenceLabel(row.budgetPeriod)}` : "Ohne Budget"}</span>{row.budget > 0 && <div className="bar-wrap budget-bar"><span style={{ width: `${Math.max(4, eurUsage)}%`, background: row.color }} /></div>}</div>
        <div className="amount-column">{currencies.map((currency) => {
          const spending = categoryEntries.filter((entry) => entry.currency === currency && entry.kind === "EXPENSE").reduce((sum, entry) => sum + entry.amountCents, 0);
          const income = categoryEntries.filter((entry) => entry.currency === currency && entry.kind === "INCOME").reduce((sum, entry) => sum + entry.amountCents, 0);
          const saldo = income - spending;
          return <span key={currency}><strong className={saldo < 0 ? "negative" : "positive"}>Saldo {formatMoney(saldo, currency)}</strong></span>;
        })}</div>
      </div>;
    })}
  </div>;
}

function DesktopCurrencySummary({ entries, monthBudget, showBudget }: { entries: ExpenseLike[]; monthBudget: number; showBudget: boolean }) {
  const currencies = [...new Set(entries.map((entry) => entry.currency))].sort();
  return <div className="desktop-only desktop-currency-summary" role="region" aria-label="Finanzüberblick nach Währung">
    {currencies.map((currency) => {
      const currencyEntries = entries.filter((entry) => entry.currency === currency);
      const income = sumByKind(currencyEntries, "INCOME");
      const spending = sumByKind(currencyEntries, "EXPENSE");
      const saldo = income - spending;
      return <article className="desktop-currency-card" key={currency}>
        <h2>{currency}</h2>
        <dl><div><dt>Einnahmen</dt><dd>{formatMoney(income, currency)}</dd></div><div><dt>Ausgaben</dt><dd>{formatMoney(spending, currency)}</dd></div><div><dt>Saldo</dt><dd>{formatMoney(saldo, currency)}</dd></div>{currency === "EUR" && showBudget && <div><dt>Budget übrig · Zeitraum</dt><dd>{formatMoney(monthBudget - Math.max(0, spending - income), "EUR")}</dd></div>}</dl>
      </article>;
    })}
  </div>;
}

function DuplicateReviewPanel({ groups, returnTo, modalId = "ausgaben-duplikate" }: { groups: DuplicateGroup[]; returnTo: string; modalId?: string }) {
  if (groups.length === 0) return null;
  const duplicateEntryCount = groups.reduce((sum, group) => sum + group.entries.length, 0);
  return (
    <div className="duplicate-action-row">
      <div>
        <strong>Duplikatprüfung</strong>
        <span>{groups.length} Gruppen mit {duplicateEntryCount} ähnlichen Einträgen</span>
      </div>
      <ActionModal title="Duplikate prüfen" trigger="Duplikate" modalId={modalId} triggerClassName="button duplicate-action-button" wide>
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
                      <input type="hidden" name="returnTo" value={withModalParam(returnTo, modalId)} />
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
  sortKey,
  modalId = "ausgaben-sortierung"
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  sortKey: ReturnType<typeof getExpenseSortKey>;
  modalId?: string;
}) {
  const activeOption = expenseSortOptions.find((option) => option.value === sortKey) ?? expenseSortOptions[0];
  return (
    <div className="expense-sort-control">
      <span title={`Sortiert: ${activeOption.label}`}>{activeOption.label}</span>
      <ActionModal
        title="Einträge sortieren"
        trigger={<ListFilter aria-hidden="true" size={18} />}
        triggerLabel="Einträge sortieren"
        modalId={modalId}
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
  const rangeEntries = filterExpenseAssignments(entries, params)
    .filter((entry) => isInRange(entry.date, range.from, range.to));
  return filterExpenseFacets(rangeEntries, params)
    .filter((entry) => !query || matchesExpenseSearch(entry, query, { documents: [] }));
}

const entryPageSize = 100;

function getInitialEntryLimit(mode: ReturnType<typeof getRange>["mode"]) {
  return mode === "month" ? 100 : entryPageSize;
}

function buildExpenseListLoadUrl(params: Awaited<ExpensesPageProps["searchParams"]>) {
  const search = new URLSearchParams();
  for (const key of ["currency", "from", "to", "year", "month", "label", "category", "kind", "q", "sort"] as const) {
    const value = params[key];
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else if (value) search.set(key, value);
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

function buildPeriodComparison(currentEntries: ExpenseLike[], compareEntries: ExpenseLike[], categories: CategoryLike[], currentRange: ReturnType<typeof getRange>, compareRange: { from: Date; to: Date }) {
  const names = new Set(categories.map((category) => category.name));
  for (const entry of [...currentEntries, ...compareEntries]) {
    if (entry.kind === "EXPENSE" || entry.kind === "INCOME") names.add(entry.category?.name ?? "Ohne Kategorie");
  }
  const rows = [...names].map((name) => {
    const currentSaldo = sumCategorySaldo(currentEntries, name);
    const compareSaldo = sumCategorySaldo(compareEntries, name);
    return {
      name,
      currentSaldo,
      compareSaldo,
      delta: currentSaldo - compareSaldo
    };
  }).filter((row) => row.currentSaldo !== 0 || row.compareSaldo !== 0)
    .sort((a, b) => Math.max(Math.abs(b.currentSaldo), Math.abs(b.compareSaldo)) - Math.max(Math.abs(a.currentSaldo), Math.abs(a.compareSaldo)));
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

function sumCategorySaldo(entries: ExpenseLike[], categoryName: string) {
  return entries
    .filter((entry) => (entry.category?.name ?? "Ohne Kategorie") === categoryName)
    .reduce((sum, entry) => sum + (entry.kind === "INCOME" ? entry.amountCents : -entry.amountCents), 0);
}

function rangeLabel(range: { from: Date; to: Date }) {
  return `${formatDate(range.from)} bis ${formatDate(range.to)}`;
}

function formatCalendarBound(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function dateInputKey(date: Date) {
  return date.toISOString().slice(0, 10);
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


