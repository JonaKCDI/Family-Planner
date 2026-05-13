import {
  createCategory,
  createExpenseLabel,
  deleteExpense,
  exportExpensesToCsv,
  importExpensesFromCsv,
  importExpensesFromUploadedCsv,
  updateCategory,
  updateExpense
} from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { getDocumentsForLinkedEntities, getExpenseLabels, getVisibleCategories, getVisibleExpenses } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { EmptyState, PageHeader } from "@/components/ui";

type ExpensesPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    year?: string;
    month?: string;
    label?: string;
    category?: string;
    q?: string;
    compareA?: string;
    compareB?: string;
  }>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [expenses, categories, labels] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id)
  ]);
  const documents = await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", expenses.map((expense) => expense.id));
  const documentsByExpense = groupBy(documents, (document) => document.linkedEntityId ?? "");
  const query = normalizeSearch(params.q);
  const currentYear = new Date().getFullYear();
  const years = [...new Set([currentYear, ...expenses.map((entry) => new Date(entry.date).getFullYear())])].sort((a, b) => b - a);
  const range = getRange(params, currentYear);
  const selectedEntries = expenses
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => !params.label || entry.labelId === params.label)
    .filter((entry) => !params.category || entry.categoryId === params.category)
    .filter((entry) => !query || matchesExpense(entry, query));
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

  return (
    <>
      <PageHeader title="Ausgaben & Einnahmen" description="Persönliche Finanzübersicht mit Bezahlart, Kategorien, Labels, Analyse und CSV-Sicherung." />

      <form className="search-bar">
        {params.year ? <input type="hidden" name="year" value={params.year} /> : null}
        {params.month ? <input type="hidden" name="month" value={params.month} /> : null}
        {params.from ? <input type="hidden" name="from" value={params.from} /> : null}
        {params.to ? <input type="hidden" name="to" value={params.to} /> : null}
        {params.label ? <input type="hidden" name="label" value={params.label} /> : null}
        {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
        <label>
          <span>Ausgaben durchsuchen</span>
          <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Beschreibung, Kategorie, Label, Bezahlart ..." />
        </label>
        <button className="button secondary" type="submit">Suchen</button>
        {query ? <a className="button secondary" href={buildExpensesHref(params, { q: undefined })}>Suche löschen</a> : null}
      </form>

      <section className="overview-actions">
        <ActionModal title="Ausgaben filtern" trigger="Filter">
            <form className="form form-grid">
              {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
              <label>Von<input name="from" type="date" defaultValue={toDateInputValue(range.from)} /></label>
              <label>Bis<input name="to" type="date" defaultValue={toDateInputValue(range.to)} /></label>
              <label>
                Kategorie
                <select name="category" defaultValue={params.category ?? ""}>
                  <option value="">Alle Kategorien</option>
                  {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Label
                <select name="label" defaultValue={params.label ?? ""}>
                  <option value="">Alle Labels</option>
                  {labels.map((label) => <option value={label.id} key={label.id}>{label.name}</option>)}
                </select>
              </label>
              <div className="filter-actions full-span">
                <button className="button" type="submit">Anwenden</button>
                <a className="button secondary" href={params.q ? `/ausgaben?q=${encodeURIComponent(params.q)}` : "/ausgaben"}>Filter löschen</a>
              </div>
            </form>
        </ActionModal>

        <ActionModal title="Ausgaben-Setup" trigger="Setup" wide>
            <div className="setup-grid">
              <section>
                <h2 className="section-title">Label hinzufügen</h2>
                <form action={createExpenseLabel} className="form compact" id="label-erfassen">
                  <label>Name<input name="name" placeholder="Dienstreise Berlin, Gartenprojekt ..." required /></label>
                  <label>Budget in EUR<input name="budget" inputMode="decimal" placeholder="500,00" /></label>
                  <label>Farbe<input name="color" type="color" defaultValue="#16776f" /></label>
                  <button className="button secondary" type="submit">Label speichern</button>
                </form>
              </section>
              <section>
                <h2 className="section-title">Kategorie hinzufügen</h2>
                <form action={createCategory} className="form compact" id="kategorie-erfassen">
                  <input type="hidden" name="type" value="EXPENSE" />
                  <label>Name<input name="name" placeholder="Schule, Urlaub, Kindergeld ..." required /></label>
                  <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" placeholder="250,00" /></label>
                  <label>Farbe<input name="color" type="color" defaultValue="#2f6fed" /></label>
                  <button className="button secondary" type="submit">Kategorie speichern</button>
                </form>
              </section>
              <section>
                <h2 className="section-title">CSV-Sicherung</h2>
                <div className="csv-actions">
                  <a className="button secondary" href="/api/expenses/export">CSV herunterladen</a>
                  <form action={importExpensesFromUploadedCsv} className="upload-form">
                    <input name="csvFile" type="file" accept=".csv,text/csv" required />
                    <button className="button secondary" type="submit">CSV hochladen</button>
                  </form>
                  <form action={importExpensesFromCsv}><button className="button secondary" type="submit">Synology-CSV importieren</button></form>
                  <form action={exportExpensesToCsv}><button className="button secondary" type="submit">Synology-CSV exportieren</button></form>
                </div>
                <p className="muted">Download/Upload funktioniert lokal sofort. Die Synology-Aktionen nutzen optional EXPENSE_CSV_PATH.</p>
              </section>
            </div>
            <h2 className="section-title spacing-top">Kategorien bearbeiten</h2>
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
                </details>
              ))}
            </div>
        </ActionModal>
      </section>

      <nav className="year-strip" aria-label="Zeitraumfilter">
        <a className={!params.year && !params.month && !params.from ? "active" : ""} href="/ausgaben">Aktueller Monat</a>
        {years.map((year) => <a className={params.year === String(year) ? "active" : ""} href={`/ausgaben?year=${year}`} key={year}>{year}</a>)}
      </nav>

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

      <section className="panel expense-section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Einträge</h2>
            <p className="muted">{formatDate(range.from)} bis {formatDate(range.to)} · {selectedEntries.length} Einträge · nur dein persönlicher Bereich</p>
          </div>
          <span className="badge">CSV-kompatibel</span>
        </div>
        <div className="expense-list">
          {selectedEntries.length === 0 ? <EmptyState>Noch keine Einträge im gewählten Zeitraum.</EmptyState> : null}
          {selectedEntries.map((expense) => {
            const linkedDocuments = documentsByExpense[expense.id] ?? [];
            const primaryDocument = linkedDocuments[0];
            return (
              <details className="expense-row" key={expense.id}>
                <summary>
                  <span>{formatDate(expense.date)}</span>
                  <span>
                    {expense.description}
                    <small>{expense.category?.name ?? "Ohne Kategorie"} · {expense.paymentMethod}{expense.label ? ` · ${expense.label.name}` : ""}</small>
                  </span>
                  <strong className={expense.kind === "INCOME" ? "positive" : "negative"}>
                    {expense.kind === "INCOME" ? "+" : "-"}{formatMoney(expense.amountCents, expense.currency)}
                  </strong>
                </summary>
                <div className="expense-detail">
                  <div className="badge-row">
                    <span className="badge">{expense.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</span>
                    <span className="badge">{expense.paymentMethod}</span>
                    {expense.category ? <span className="badge" style={{ borderColor: expense.category.color }}>{expense.category.name}</span> : null}
                    {expense.label ? <span className="badge label-badge" style={{ background: expense.label.color }}>{expense.label.name}</span> : null}
                    {linkedDocuments.length === 0 ? <span className="badge">Kein Dokument</span> : null}
                    {linkedDocuments.map((document) => (
                      <a className="badge link-badge" href={document.url} key={document.id} target="_blank" rel="noreferrer">
                        {document.title}
                      </a>
                    ))}
                  </div>
                  <div className="entry-actions">
                    <form action={deleteExpense}>
                      <input type="hidden" name="id" value={expense.id} />
                      <button className="button secondary" type="submit">Löschen</button>
                    </form>
                    <ActionModal title="Eintrag bearbeiten" trigger="Bearbeiten">
                      <form action={updateExpense} className="form form-grid modal-form">
                        <input type="hidden" name="id" value={expense.id} />
                        <label>
                          Art
                          <select name="kind" defaultValue={expense.kind}>
                            <option value="EXPENSE">Ausgabe</option>
                            <option value="INCOME">Einnahme</option>
                          </select>
                        </label>
                        <label>Betrag in EUR<input name="amount" inputMode="decimal" defaultValue={formatEuroInput(expense.amountCents)} required /></label>
                        <label>Datum<input name="date" type="date" defaultValue={toDateInputValue(expense.date)} required /></label>
                        <label>Bezahlart<input name="paymentMethod" list="payment-methods" defaultValue={expense.paymentMethod} /></label>
                        <label>
                          Kategorie
                          <select name="categoryId" defaultValue={expense.categoryId ?? ""}>
                            <option value="">Keine Kategorie</option>
                            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                          </select>
                        </label>
                        <label>
                          Label / Projekt
                          <select name="labelId" defaultValue={expense.labelId ?? ""}>
                            <option value="">Kein Label</option>
                            {labels.map((label) => <option value={label.id} key={label.id}>{label.name}</option>)}
                          </select>
                        </label>
                        <label>Beschreibung<input name="description" defaultValue={expense.description} required /></label>
                        <PaymentMethods />
                        <fieldset className="fieldset full-span">
                          <legend>Drive-Link optional verknüpfen</legend>
                          <input type="hidden" name="documentId" value={primaryDocument?.id ?? ""} />
                          <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.title ?? ""} placeholder="Rechnung, Beleg, Nachweis ..." /></label>
                          <label>Drive-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
                        </fieldset>
                        <button className="button full-span" type="submit">Änderungen speichern</button>
                      </form>
                    </ActionModal>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

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
                    <span className="muted">{row.percent.toFixed(1)}% der Ausgaben{showBudget ? ` · Monatsbudget ${formatMoney(row.budget)}` : ""}</span>
                  </div>
                  <div className="bar-stack">
                    <div className="bar-wrap"><span style={{ width: `${row.percent}%`, background: row.color }} /></div>
                    {showBudget ? <div className="bar-wrap budget-bar"><span style={{ width: `${row.budgetUsage}%`, background: row.color }} /></div> : null}
                  </div>
                  <div className="amount-column compact-amount">
                    <strong>{formatMoney(row.amount)}</strong>
                    {showBudget ? <small className={row.remaining < 0 ? "negative" : "positive"}>{row.remaining < 0 ? "drüber " : "frei "}{formatMoney(Math.abs(row.remaining))}</small> : null}
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
                    <div><strong>{row.name}</strong><span className="muted">Budget {formatMoney(row.budget)}</span></div>
                    <div className="bar-wrap"><span style={{ width: `${row.budgetUsage}%`, background: row.color }} /></div>
                    <div className="amount-column compact-amount">
                      <strong>{formatMoney(row.amount)}</strong>
                      <small className={row.remaining < 0 ? "negative" : "positive"}>{row.remaining < 0 ? "drüber " : "frei "}{formatMoney(Math.abs(row.remaining))}</small>
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

function getRange(params: Awaited<ExpensesPageProps["searchParams"]>, currentYear: number) {
  if (params.from || params.to) {
    const now = new Date();
    return {
      mode: "custom" as const,
      from: params.from ? new Date(params.from) : new Date(now.getFullYear(), now.getMonth(), 1),
      to: params.to ? endOfDay(new Date(params.to)) : endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }
  if (params.month) {
    const [year, month] = params.month.split("-").map(Number);
    return { mode: "month" as const, from: new Date(year, month - 1, 1), to: endOfDay(new Date(year, month, 0)) };
  }
  if (params.year) {
    const year = Number(params.year);
    return { mode: "year" as const, from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
  }
  const now = new Date();
  return { mode: "month" as const, from: new Date(currentYear, now.getMonth(), 1), to: endOfDay(new Date(currentYear, now.getMonth() + 1, 0)) };
}

function endOfDay(date: Date) {
  date.setHours(23, 59, 59, 999);
  return date;
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
      budgetUsage: budget > 0 ? Math.min(100, (row.amount / budget) * 100) : 0,
      percent: totalSpending > 0 ? (row.amount / totalSpending) * 100 : 0
    };
  }).sort((a, b) => b.amount - a.amount);
}

function buildLabelRows(entries: ExpenseLike[], labels: LabelLike[]) {
  const rows = new Map<string, { amount: number; color: string; budget: number }>();
  for (const label of labels) rows.set(label.name, { amount: 0, color: label.color, budget: label.budgetCents });
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE" || !entry.label) continue;
    const current = rows.get(entry.label.name) ?? { amount: 0, color: entry.label.color, budget: entry.label.budgetCents };
    current.amount += entry.amountCents;
    rows.set(entry.label.name, current);
  }
  return [...rows.entries()].map(([name, row]) => ({
    name,
    ...row,
    remaining: row.budget - row.amount,
    budgetUsage: row.budget > 0 ? Math.min(100, (row.amount / row.budget) * 100) : 0
  })).filter((row) => row.amount > 0 || row.budget > 0).sort((a, b) => b.amount - a.amount);
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
    entry.paymentMethod,
    entry.category?.name,
    entry.label?.name,
    entry.kind === "INCOME" ? "einnahme" : "ausgabe",
    entry.currency
  ].some((value) => normalizeSearch(value).includes(query));
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function buildExpensesHref(
  params: Awaited<ExpensesPageProps["searchParams"]>,
  overrides: Partial<Awaited<ExpensesPageProps["searchParams"]>>
) {
  const next = new URLSearchParams();
  const merged = { ...params, ...overrides };
  for (const key of ["from", "to", "year", "month", "label", "category", "q", "compareA", "compareB"] as const) {
    const value = merged[key];
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `/ausgaben?${query}` : "/ausgaben";
}

function PaymentMethods() {
  return (
    <datalist id="payment-methods">
      <option value="Karte" />
      <option value="Bar" />
      <option value="Überweisung" />
      <option value="Lastschrift" />
      <option value="PayPal" />
      <option value="Apple Pay" />
    </datalist>
  );
}

type ExpenseLike = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
type CategoryLike = Awaited<ReturnType<typeof getVisibleCategories>>[number];
type LabelLike = Awaited<ReturnType<typeof getExpenseLabels>>[number];
