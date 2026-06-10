import {
  archiveExpenseLabel,
  createCategory,
  createExpenseLabel,
  createRecurringTransaction,
  deleteCategory,
  deleteExpenseLabel,
  exportExpensesToSynologyExcel,
  importExpensesFromSynologyExcel,
  importExpensesFromUploadedXlsx,
  mergeDuplicateExpenses,
  mergeExpenseCategories,
  mergeExpenseLabels,
  pauseRecurringTransaction,
  softDeleteRecurringTransaction,
  unarchiveExpenseLabel,
  updateCategory,
  updateExpenseLabel,
  updateRecurringTransaction,
} from "@/lib/actions";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { toExpenseDocumentItem, toExpenseListItem } from "@/lib/expense-list";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { buildExpensesHref, buildMonthNavigationHref, buildPeriodHref, buildYearNavigationHref, getCanonicalExpensesHref, getMonthKey, getRawExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { formatMonthKeyLabel } from "@/lib/month-options";
import { getDocumentsForLinkedEntities, getExpenseLabels, getRecurringTransactions, getVisibleCategories, getVisibleContracts, getVisibleExpenses } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { ExcelProgressPanel } from "@/components/excel-progress-panel";
import { ExpenseEntryList } from "@/components/expense-entry-list";
import { ExpenseFilterForm } from "@/components/expense-filter-form";
import { SearchableSelect } from "@/components/searchable-select";
import { EmptyState, PageHeader } from "@/components/ui";

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
  const exportYear = range.from.getFullYear();
  const selectedEntries = expenses
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => !params.label || entry.labelId === params.label)
    .filter((entry) => !params.category || entry.categoryId === params.category)
    .filter((entry) => !query || matchesExpense(entry, query));
  const duplicateGroups = buildDuplicateGroups(selectedEntries);
  const duplicateCounts = buildDuplicateCounts(duplicateGroups);
  const income = sumByKind(selectedEntries, "INCOME");
  const spending = sumByKind(selectedEntries, "EXPENSE");
  const saldo = income - spending;
  const showBudget = range.mode === "month";
  const monthBudget = showBudget ? categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0) : 0;
  const categoryRows = buildCategoryRows(selectedEntries, categories, spending, showBudget);
  const labelRows = buildLabelRows(selectedEntries, labels);
  const monthlyRows = buildPeriodRows(selectedEntries, categories, "month");
  const yearlyRows = buildPeriodRows(expenses, categories, "year");
  const comparison = buildYearComparison(expenses, categories, Number(params.compareA ?? years[0]), Number(params.compareB ?? years[1] ?? years[0]));
  const pie = buildPie(categoryRows);
  const activeFilterChips = buildActiveFilterChips(params, categories, allLabels, range);
  const initialEntryLimit = getInitialEntryLimit(range.mode);
  const initialEntries = selectedEntries.slice(0, initialEntryLimit);
  const documents = await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", initialEntries.map((expense) => expense.id));
  const documentsByExpense = groupBy(documents.map(toExpenseDocumentItem), (document) => document.linkedEntityId ?? "");
  const expenseListEntries = initialEntries.map(toExpenseListItem);
  const expenseListLoadUrl = buildExpenseListLoadUrl(params);
  const returnTo = getRawExpensesHref(params);

  return (
    <>
      <PageHeader title="Ausgaben & Einnahmen" />

      <form className="search-bar">
        <FilterHiddenFields params={params} includePeriod />
        <label>
          <span>Ausgaben durchsuchen</span>
          <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Beschreibung, Kategorie, Label, Vertrag ..." />
        </label>
        <button className="button secondary" type="submit">Suchen</button>
        {query ? <a className="button secondary" href={buildExpensesHref(params, { q: undefined })}>Suche löschen</a> : null}
      </form>

      <section className="filter-system" aria-label="Ausgabenfilter">
        <div className="period-navigator">
          <PeriodNavigator params={params} range={range} currentMonthKey={currentMonthKey} />
          <div className="period-tools">
            <a className="button period-primary-action" href={buildPeriodHref(params, { month: currentMonthKey })}>Aktuell</a>
            <ActionModal title="Ausgaben filtern" trigger="Filter" triggerClassName="button period-primary-action">
              <ExpenseFilterForm params={params} categories={categories} labels={labels} years={years} currentMonthKey={currentMonthKey} />
            </ActionModal>
          </div>
        </div>
        <div className="overview-actions secondary-filter-actions">
        <ActionModal title="Serien verwalten" trigger="Serien" wide>
          <RecurringTransactionsPanel recurringTransactions={recurringTransactions} categories={categories} labels={labels} />
        </ActionModal>

        <ActionModal title="Ausgaben-Setup" trigger="Setup" wide>
          <div className="expense-setup-layout">
            <section className="setup-card setup-card-primary">
              <div className="setup-card-head">
                <div>
                  <h2 className="section-title">Excel-Sicherung</h2>
                  <p className="muted">Export und Import für das aktuell ausgewählte Jahr {exportYear}.</p>
                </div>
              </div>
              <ExcelProgressPanel>
                <div className="excel-actions">
                  <a className="button secondary" href={`/api/expenses/export?year=${exportYear}`} data-excel-progress={`Excel ${exportYear} wird vorbereitet ...`}>Excel {exportYear} herunterladen</a>
                  <form action={importExpensesFromUploadedXlsx} className="upload-form">
                    <input name="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
                    <button className="button secondary" type="submit" data-excel-progress="Excel-Datei wird importiert ...">Excel hochladen</button>
                  </form>
                  <div className="setup-action-row">
                    <form action={importExpensesFromSynologyExcel}>
                      <input type="hidden" name="year" value={exportYear} />
                      <button className="button secondary" type="submit" data-excel-progress="Synology-Import läuft ...">Synology importieren</button>
                    </form>
                    <form action={exportExpensesToSynologyExcel}>
                      <input type="hidden" name="year" value={exportYear} />
                      <button className="button secondary" type="submit" data-excel-progress="Synology-Export läuft ...">Synology exportieren</button>
                    </form>
                  </div>
                </div>
              </ExcelProgressPanel>
            </section>

            <details className="setup-card" open>
              <summary>
                <span>
                  <strong>Anlegen</strong>
                  <small>Neue Labels und Kategorien</small>
                </span>
              </summary>
              <div className="setup-two-column">
                <form action={createExpenseLabel} className="form compact" id="label-erfassen">
                  <strong>Label hinzufügen</strong>
                  <label>Name<input name="name" placeholder="Dienstreise Berlin, Gartenprojekt ..." required /></label>
                  <label>Budget in EUR<input name="budget" inputMode="decimal" placeholder="500,00" /></label>
                  <label>Farbe<input name="color" type="color" defaultValue="#16776f" /></label>
                  <button className="button secondary" type="submit">Label speichern</button>
                </form>
                <form action={createCategory} className="form compact" id="kategorie-erfassen">
                  <strong>Kategorie hinzufügen</strong>
                  <input type="hidden" name="type" value="EXPENSE" />
                  <label>Name<input name="name" placeholder="Schule, Urlaub, Kindergeld ..." required /></label>
                  <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" placeholder="250,00" /></label>
                  <label>Farbe<input name="color" type="color" defaultValue="#2f6fed" /></label>
                  <button className="button secondary" type="submit">Kategorie speichern</button>
                </form>
              </div>
            </details>

            <details className="setup-card">
              <summary>
                <span>
                  <strong>Labels verwalten</strong>
                  <small>Aktive Labels nach letzter Nutzung, archivierte am Ende</small>
                </span>
              </summary>
              <div className="label-management-list">
                {allLabels.length === 0 ? <EmptyState>Noch keine Labels vorhanden.</EmptyState> : null}
                {allLabels.map((label) => (
                  <div className={label.archivedAt ? "label-management-row archived" : "label-management-row"} key={label.id}>
                    <div>
                      <strong>{label.name}</strong>
                      <span className="muted">
                        {label.archivedAt ? "Archiviert" : "Aktiv"}{" · "}{label.lastUsedAt ? `Zuletzt genutzt: ${formatDate(label.lastUsedAt)}` : "Noch nicht genutzt"}
                      </span>
                    </div>
                    <div className="label-management-actions">
                      <ActionModal title="Label bearbeiten" trigger="Bearbeiten">
                        <form action={updateExpenseLabel} className="form compact">
                          <input type="hidden" name="id" value={label.id} />
                          <label>Name<input name="name" defaultValue={label.name} required /></label>
                          <label>Budget in EUR<input name="budget" inputMode="decimal" defaultValue={formatEuroInput(label.budgetCents)} /></label>
                          <label>Farbe<input name="color" type="color" defaultValue={label.color} /></label>
                          <button className="button secondary" type="submit">Änderungen speichern</button>
                        </form>
                      </ActionModal>
                      <form action={label.archivedAt ? unarchiveExpenseLabel : archiveExpenseLabel}>
                        <input type="hidden" name="id" value={label.id} />
                        <button className="button secondary" type="submit">{label.archivedAt ? "Wieder aktivieren" : "Archivieren"}</button>
                      </form>
                      <form action={deleteExpenseLabel}>
                        <input type="hidden" name="id" value={label.id} />
                        <button className="button secondary danger-subtle" type="submit">Löschen</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details className="setup-card">
              <summary>
                <span>
                  <strong>Zusammenführen</strong>
                  <small>Typo-Daten in das richtige Ziel schieben</small>
                </span>
              </summary>
              <div className="merge-tools">
                <form action={mergeExpenseLabels} className="form compact">
                  <strong>Labels</strong>
                  <label>
                    Von
                    <select name="sourceLabelId" required defaultValue="">
                      <option value="" disabled>Typo wählen</option>
                      {allLabels.map((label) => <option value={label.id} key={label.id}>{label.name}{label.archivedAt ? " (archiviert)" : ""}</option>)}
                    </select>
                  </label>
                  <label>
                    Nach
                    <select name="targetLabelId" required defaultValue="">
                      <option value="" disabled>Ziel wählen</option>
                      {allLabels.map((label) => <option value={label.id} key={label.id}>{label.name}{label.archivedAt ? " (archiviert)" : ""}</option>)}
                    </select>
                  </label>
                  <button className="button secondary" type="submit" disabled={allLabels.length < 2}>Labels zusammenführen</button>
                </form>
                <form action={mergeExpenseCategories} className="form compact">
                  <strong>Kategorien</strong>
                  <label>
                    Von
                    <select name="sourceCategoryId" required defaultValue="">
                      <option value="" disabled>Typo wählen</option>
                      {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Nach
                    <select name="targetCategoryId" required defaultValue="">
                      <option value="" disabled>Ziel wählen</option>
                      {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <button className="button secondary" type="submit" disabled={categories.length < 2}>Kategorien zusammenführen</button>
                </form>
              </div>
            </details>

            <details className="setup-card">
              <summary>
                <span>
                  <strong>Kategorien bearbeiten</strong>
                  <small>Budget, Farbe und Name anpassen</small>
                </span>
              </summary>
              <div className="category-editor-list">
                {categories.map((category) => (
                  <details className="category-editor" key={category.id}>
                    <summary>
                      <span className="color-dot" style={{ background: category.color }} />
                      <span>{category.name}</span>
                      <strong>{formatMoney(category.monthlyBudgetCents)}</strong>
                    </summary>
                    <form action={updateCategory} className="form compact">
                      <input type="hidden" name="id" value={category.id} />
                      <label>Name<input name="name" defaultValue={category.name} required /></label>
                      <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" defaultValue={formatEuroInput(category.monthlyBudgetCents)} /></label>
                      <label>Farbe<input name="color" type="color" defaultValue={category.color} /></label>
                      <input type="hidden" name="scope" value="PRIVATE" />
                      <button className="button secondary" type="submit">Änderungen speichern</button>
                    </form>
                    <div className="category-editor-actions">
                      <form action={deleteCategory}>
                        <input type="hidden" name="id" value={category.id} />
                        <button className="button secondary danger-subtle" type="submit">Kategorie löschen</button>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </div>
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
          <span>{showBudget ? "Monatsbudget übrig" : "Budget"}</span>
          {showBudget ? (
            <>
              <strong className={monthBudget - spending < 0 ? "negative" : "positive"}>{formatMoney(monthBudget - spending)}</strong>
              <small>{formatMoney(monthBudget)} geplant</small>
            </>
          ) : (
            <>
              <strong>Nur Monatsansicht</strong>
              <small>Jahresansichten zeigen keine Budgetreste</small>
            </>
          )}
        </div>
      </section>

      <details className="panel expense-section" open>
        <summary className="expense-section-summary">
          <div>
            <h2 className="section-title">Einträge</h2>
            <p className="muted">{formatDate(range.from)} bis {formatDate(range.to)} · {selectedEntries.length} Einträge</p>
          </div>
        </summary>
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
      </details>

      <section className="analysis-tabs spacing-top">
        <details className="panel" open>
          <summary className="section-title">Analyse</summary>
          <div className="analysis-overview">
            <div className="pie-card">
              <div className="pie-chart" style={{ background: pie.background }} />
              <div className="pie-legend">
                {categoryRows.map((row) => (
                  <span key={row.name}><i style={{ background: row.color }} />{row.name} {row.percent.toFixed(0)}%</span>
                ))}
              </div>
            </div>
            <div className="list">
              {categoryRows.length === 0 ? <EmptyState>Noch keine Ausgaben im Zeitraum.</EmptyState> : null}
              {categoryRows.map((row) => (
                <div className="analysis-row" key={row.name}>
                  <div>
                    <strong>{row.name}</strong>
                    {showBudget ? <span className="muted">{row.budget > 0 ? `Budget ${formatMoney(row.budget)}` : "Ohne Budget"}</span> : null}
                  </div>
                  <div className="bar-stack">
                    <div className="bar-wrap"><span style={{ width: `${row.percent}%`, background: row.color }} /></div>
                    {showBudget ? <div className="bar-wrap budget-bar"><span style={{ width: `${row.budgetUsage}%`, background: row.color }} /></div> : null}
                  </div>
                  <div className="amount-column compact-amount">
                    <strong>{formatMoney(row.amount)}</strong>
                    {showBudget ? <BudgetHint row={row} /> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="panel">
          <summary className="section-title">Labels & Zeiträume</summary>
          <div className="analysis-grid">
            <div>
              <h3>Labels</h3>
              <div className="list">
                {labelRows.length === 0 ? <EmptyState>Noch keine Label-Ausgaben.</EmptyState> : null}
                {labelRows.map((row) => (
                  <div className="analysis-row" key={row.name}>
                    <div><strong>{row.name}</strong><span className="muted">{labelRowMeta(row)}</span></div>
                    <div className="bar-wrap"><span style={{ width: `${row.budgetUsage}%`, background: row.color }} /></div>
                    <div className="amount-column compact-amount">
                      <strong>{formatMoney(row.amount)}</strong>
                      <BudgetHint row={row} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div><h3>Monatsübersicht</h3><MiniTable rows={monthlyRows} showBudget /></div>
            <div><h3>Jahresübersicht</h3><MiniTable rows={yearlyRows} /></div>
          </div>
        </details>

        <details className="panel">
          <summary className="section-title">Jahresvergleich</summary>
          <form className="inline-form compare-form">
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
          <div className="compare-grid">
            {comparison.rows.map((row) => (
              <div className="compare-row" key={row.name}>
                <strong>{row.name}</strong>
                <span>{formatMoney(row.amountA)}</span>
                <span>{formatMoney(row.amountB)}</span>
                <span className={row.delta > 0 ? "negative" : "positive"}>{row.delta > 0 ? "+" : ""}{formatMoney(row.delta)}</span>
              </div>
            ))}
          </div>
        </details>
      </section>
    </>
  );
}

type DuplicateGroup = {
  key: string;
  entries: ExpenseLike[];
};

function DuplicateReviewPanel({ groups, returnTo }: { groups: DuplicateGroup[]; returnTo: string }) {
  if (groups.length === 0) return null;
  const duplicateEntryCount = groups.reduce((sum, group) => sum + group.entries.length, 0);
  return (
    <div className="duplicate-action-row">
      <div>
        <strong>Duplikatprüfung</strong>
        <span>{groups.length} Gruppen mit {duplicateEntryCount} ähnlichen Einträgen</span>
      </div>
      <ActionModal title="Duplikate prüfen" trigger="Duplikate" triggerClassName="button duplicate-action-button" wide>
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
                      <input type="hidden" name="returnTo" value={returnTo} />
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
      <a className="period-nav-button" href={previousHref} aria-label={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"} title={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"}>
        <span aria-hidden="true">&lsaquo;</span>
      </a>
      <div className="period-nav-current" aria-live="polite">
        <span>{detail}</span>
        <strong>{title}</strong>
      </div>
      <a className="period-nav-button" href={nextHref} aria-label={isYear ? "Nächstes Jahr" : "Nächster Monat"} title={isYear ? "Nächstes Jahr" : "Nächster Monat"}>
        <span aria-hidden="true">&rsaquo;</span>
      </a>
      <div className="period-mode-toggle" role="list" aria-label="Zeitraum-Modus">
        <a role="listitem" className={!isYear && range.mode !== "custom" ? "active" : ""} href={buildPeriodHref(params, { month: monthKey })}>Monat</a>
        <a role="listitem" className={isYear ? "active" : ""} href={buildPeriodHref(params, { year: String(currentYear) })}>Jahr</a>
      </div>
    </div>
  );
}

function RecurringTransactionsPanel({
  recurringTransactions,
  categories,
  labels
}: {
  recurringTransactions: Awaited<ReturnType<typeof getRecurringTransactions>>;
  categories: CategoryLike[];
  labels: LabelLike[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name, color: category.color }));
  const labelOptions = labels.map((label) => ({ id: label.id, name: label.name, color: label.color }));
  return (
    <div className="recurring-layout">
      <section className="setup-card setup-card-primary">
        <div className="setup-card-head">
          <div>
            <h2 className="section-title">Neue Serie</h2>
            <p className="muted">Regelmäßige private Einnahmen oder Ausgaben automatisch buchen.</p>
          </div>
        </div>
        <form action={createRecurringTransaction} className="form form-grid compact">
          <label>Titel<input name="title" placeholder="Gehalt, Miete, Sparrate ..." required /></label>
          <label>Art<select name="kind" defaultValue="EXPENSE"><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
          <label>Betrag in EUR<input name="amount" inputMode="decimal" placeholder="42,50" required /></label>
          <label>Intervall<select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
          <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
          <label>Enddatum optional<input name="endDate" type="date" /></label>
          <PaymentMethodSelect />
          <label>Laden / Quelle<input name="store" placeholder="Arbeitgeber, Vermieter, Bank ..." /></label>
          <SearchableSelect name="categoryId" label="Kategorie" options={categoryOptions} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
          <SearchableSelect name="labelId" label="Label / Projekt" options={labelOptions} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
          <input type="hidden" name="status" value="ACTIVE" />
          <label className="full-span">Beschreibung<input name="description" placeholder="Optionaler Hinweis für erzeugte Buchungen" /></label>
          <button className="button secondary full-span" type="submit">Serie speichern</button>
        </form>
      </section>

      <section className="setup-card">
        <h2 className="section-title">Bestehende Serien</h2>
        <div className="category-editor-list">
          {recurringTransactions.length === 0 ? <EmptyState>Noch keine Serien vorhanden.</EmptyState> : null}
          {recurringTransactions.map((series) => {
            const currentPhase = series.pricePhases.at(-1);
            return (
              <details className="category-editor" key={series.id}>
                <summary>
                  <span className="color-dot" style={{ background: series.category?.color ?? "#6b6f76" }} />
                  <span>{series.title}<small>{series.status === "ACTIVE" ? "Aktiv" : "Pausiert"} · {series.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</small></span>
                  <strong>{currentPhase ? formatMoney(currentPhase.amountCents, currentPhase.currency) : "-"}</strong>
                </summary>
                <form action={updateRecurringTransaction} className="form form-grid compact">
                  <input type="hidden" name="id" value={series.id} />
                  <label>Titel<input name="title" defaultValue={series.title} required /></label>
                  <label>Art<select name="kind" defaultValue={series.kind}><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
                  <label>Betrag in EUR<input name="amount" inputMode="decimal" defaultValue={formatEuroInput(currentPhase?.amountCents ?? 0)} required /></label>
                  <label>Gültig ab<input name="priceValidFrom" type="date" defaultValue={toDateInputValue(currentPhase?.validFrom ?? series.startDate)} required /></label>
                  <label>Preisänderung<select name="priceChangeMode" defaultValue="NEW_PHASE"><option value="NEW_PHASE">Neue Preisphase ab Gültig-ab</option><option value="CORRECT_CURRENT">Aktuelle Phase korrigieren</option></select></label>
                  <p className="muted full-span">Die Preisphase ändert die Vorlage für zukünftige automatische Buchungen. Die Checkbox unten ändert zusätzlich bereits erzeugte Auto-Buchungen im betroffenen Zeitraum.</p>
                  <label>Intervall<select name="billingInterval" defaultValue={currentPhase?.billingInterval ?? "MONTHLY"}><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
                  <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(series.startDate)} required /></label>
                  <label>Enddatum optional<input name="endDate" type="date" defaultValue={toDateInputValue(series.endDate)} /></label>
                  <label>Status<select name="status" defaultValue={series.status}><option value="ACTIVE">Aktiv</option><option value="PAUSED">Pausiert</option></select></label>
                  <PaymentMethodSelect defaultValue={series.paymentMethod} />
                  <label>Laden / Quelle<input name="store" defaultValue={series.store} /></label>
                  <SearchableSelect name="categoryId" label="Kategorie" options={categoryOptions} defaultValue={series.categoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
                  <SearchableSelect name="labelId" label="Label / Projekt" options={labelOptions} defaultValue={series.labelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
                  <label className="checkbox-field full-span"><input name="updateGeneratedExpenses" type="checkbox" /> Bereits erzeugte Auto-Buchungen ab Gültig-ab aktualisieren</label>
                  <label className="full-span">Beschreibung<input name="description" defaultValue={series.description} /></label>
                  <div className="full-span price-history">
                    <strong>Preisentwicklung</strong>
                    {series.pricePhases.map((phase) => (
                      <span className="badge" key={phase.id}>
                        {formatMoney(phase.amountCents, phase.currency)} · {recurringIntervalLabels[phase.billingInterval]} · ab {formatDate(phase.validFrom)}{phase.validTo ? ` bis ${formatDate(phase.validTo)}` : ""}
                      </span>
                    ))}
                  </div>
                  <button className="button secondary full-span" type="submit">Änderungen speichern</button>
                </form>
                <div className="category-editor-actions">
                  <form action={pauseRecurringTransaction}>
                    <input type="hidden" name="id" value={series.id} />
                    <button className="button secondary" type="submit">Pausieren</button>
                  </form>
                  <form action={softDeleteRecurringTransaction}>
                    <input type="hidden" name="id" value={series.id} />
                    <button className="button secondary danger-subtle" type="submit">Entfernen</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </section>
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
  return <small className={row.remaining < 0 ? "negative" : "positive"}>{row.remaining < 0 ? "drüber " : "frei "}{formatMoney(Math.abs(row.remaining))}</small>;
}

function labelRowMeta(row: { budget: number; neverUsed?: boolean }) {
  const budget = row.budget > 0 ? `Budget ${formatMoney(row.budget)}` : "Ohne Budget";
  return row.neverUsed ? `Noch nicht genutzt · ${budget}` : budget;
}

function PaymentMethodSelect({ defaultValue = "Nicht angegeben" }: { defaultValue?: string }) {
  const value = defaultValue || "Nicht angegeben";
  const options = ["Nicht angegeben", "Karte", "Bar", "Überweisung", "Lastschrift", "PayPal", "Apple Pay"];
  const visibleOptions = options.includes(value) ? options : [value, ...options];
  return (
    <label>
      Bezahlart
      <select name="paymentMethod" defaultValue={value}>
        {visibleOptions.map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function FilterHiddenFields({
  params,
  includeSearch = false,
  includePeriod = false,
  includeFacets = true
}: {
  params: Awaited<ExpensesPageProps["searchParams"]>;
  includeSearch?: boolean;
  includePeriod?: boolean;
  includeFacets?: boolean;
}) {
  return (
    <>
      {includeSearch && params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {includePeriod && params.year ? <input type="hidden" name="year" value={params.year} /> : null}
      {includePeriod && params.month ? <input type="hidden" name="month" value={params.month} /> : null}
      {includePeriod && params.from ? <input type="hidden" name="from" value={params.from} /> : null}
      {includePeriod && params.to ? <input type="hidden" name="to" value={params.to} /> : null}
      {includeFacets && params.label ? <input type="hidden" name="label" value={params.label} /> : null}
      {includeFacets && params.category ? <input type="hidden" name="category" value={params.category} /> : null}
    </>
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
  for (const key of ["from", "to", "year", "month", "label", "category", "q"] as const) {
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

function sumByKind(entries: ExpenseLike[], kind: "EXPENSE" | "INCOME") {
  return entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amountCents, 0);
}

function buildCategoryRows(entries: ExpenseLike[], categories: CategoryLike[], totalSpending: number, showBudget: boolean) {
  const rows = new Map<string, { amount: number; color: string; category?: CategoryLike }>();
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE") continue;
    const name = entry.category?.name ?? "Ohne Kategorie";
    const current = rows.get(name) ?? { amount: 0, color: entry.category?.color ?? "#6b6f76", category: entry.category ?? undefined };
    current.amount += entry.amountCents;
    rows.set(name, current);
  }
  if (showBudget) {
    for (const category of categories) {
      if (category.monthlyBudgetCents <= 0 || rows.has(category.name)) continue;
      rows.set(category.name, { amount: 0, color: category.color, category });
    }
  }

  return [...rows.entries()].map(([name, row]) => {
    const budget = showBudget ? row.category?.monthlyBudgetCents ?? 0 : 0;
    return {
      name,
      amount: row.amount,
      color: row.color,
      budget,
      remaining: budget - row.amount,
      budgetUsage: budget > 0 ? Math.min(100, (row.amount / budget) * 100) : row.amount > 0 ? 100 : 0,
      percent: totalSpending > 0 ? (row.amount / totalSpending) * 100 : 0
    };
  }).sort((a, b) => b.amount - a.amount);
}

function buildLabelRows(entries: ExpenseLike[], labels: LabelLike[]) {
  const rows = new Map<string, { amount: number; color: string; budget: number; neverUsed: boolean }>();
  const labelsByName = new Map(labels.map((label) => [label.name, label]));
  for (const label of labels) {
    if (label.lastUsedAt !== null) continue;
    rows.set(label.name, { amount: 0, color: label.color, budget: label.budgetCents, neverUsed: true });
  }
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE" || !entry.label) continue;
    const configuredLabel = labelsByName.get(entry.label.name);
    const current = rows.get(entry.label.name) ?? {
      amount: 0,
      color: configuredLabel?.color ?? entry.label.color,
      budget: configuredLabel?.budgetCents ?? entry.label.budgetCents,
      neverUsed: false
    };
    current.amount += entry.amountCents;
    current.neverUsed = false;
    rows.set(entry.label.name, current);
  }
  return [...rows.entries()].map(([name, row]) => ({
    name,
    amount: row.amount,
    color: row.color,
    budget: row.budget,
    neverUsed: row.neverUsed,
    remaining: row.budget - row.amount,
    budgetUsage: row.budget > 0 ? Math.min(100, (row.amount / row.budget) * 100) : row.amount > 0 ? 100 : 0
  })).filter((row) => row.amount > 0 || row.neverUsed).sort((a, b) => b.amount - a.amount);
}

type PeriodRow = { label: string; income: number; spending: number; budget: number; saldo: number };

function buildPeriodRows(entries: ExpenseLike[], categories: CategoryLike[], mode: "month" | "year"): PeriodRow[] {
  const rows = new Map<string, PeriodRow>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const label = mode === "month" ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : String(date.getFullYear());
    const row = rows.get(label) ?? { label, income: 0, spending: 0, budget: mode === "month" ? monthlyBudget(categories) : 0, saldo: 0 };
    if (entry.kind === "INCOME") row.income += entry.amountCents;
    if (entry.kind === "EXPENSE") row.spending += entry.amountCents;
    row.saldo = row.income - row.spending;
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => b.label.localeCompare(a.label)).slice(0, 12);
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

function monthlyBudget(categories: CategoryLike[]) {
  return categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0);
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

function buildPie(rows: ReturnType<typeof buildCategoryRows>) {
  if (rows.length === 0) return { background: "#ece8dc" };
  let cursor = 0;
  const stops = rows.filter((row) => row.percent > 0).map((row) => {
    const start = cursor;
    cursor += row.percent;
    return `${row.color} ${start}% ${cursor}%`;
  });
  return { background: `conic-gradient(${stops.join(", ")})` };
}

function matchesExpense(entry: ExpenseLike, query: string) {
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

const recurringIntervalLabels = {
  MONTHLY: "Monatlich",
  YEARLY: "Jährlich",
  QUARTERLY: "Quartalsweise",
  ONCE: "Einmalig",
  OTHER: "Sonstiges"
};

type ExpenseLike = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
type CategoryLike = Awaited<ReturnType<typeof getVisibleCategories>>[number];
type LabelLike = Awaited<ReturnType<typeof getExpenseLabels>>[number];

