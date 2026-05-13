import { createCategory, createExpense, deleteExpense, updateCategory } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { getDocumentsForLinkedEntities, getVisibleCategories, getVisibleExpenses } from "@/lib/queries";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

type ExpensesPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const range = getRange(params.from, params.to);
  const [expenses, categories] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE")
  ]);
  const documents = await getDocumentsForLinkedEntities(
    session.family.id,
    session.user.id,
    "EXPENSE",
    expenses.map((expense) => expense.id)
  );
  const documentsByExpense = groupBy(documents, (document) => document.linkedEntityId ?? "");
  const selectedEntries = expenses.filter((entry) => isInRange(entry.date, range.from, range.to));
  const currentYearEntries = expenses.filter((entry) => new Date(entry.date).getFullYear() === new Date().getFullYear());

  const income = sumByKind(selectedEntries, "INCOME");
  const spending = sumByKind(selectedEntries, "EXPENSE");
  const saldo = income - spending;
  const rangeBudget = budgetForRange(categories, range.from, range.to);
  const budgetDelta = rangeBudget - spending;
  const categoryRows = buildCategoryRows(selectedEntries, categories, spending, range);
  const monthlyRows = buildPeriodRows(selectedEntries, categories, "month");
  const yearlyRows = buildPeriodRows(expenses, categories, "year");

  return (
    <>
      <PageHeader title="Ausgaben & Einnahmen" description="Kompakt erfassen, Budget prüfen und Kategorien sauber pflegen." />

      <section className="panel filter-panel">
        <form className="inline-form">
          <label>
            Von
            <input name="from" type="date" defaultValue={toDateInputValue(range.from)} />
          </label>
          <label>
            Bis
            <input name="to" type="date" defaultValue={toDateInputValue(range.to)} />
          </label>
          <button className="button" type="submit">Zeitraum anwenden</button>
        </form>
      </section>

      <section className="stats">
        <div className="stat"><span>Einnahmen</span><strong>{formatMoney(income)}</strong></div>
        <div className="stat"><span>Ausgaben</span><strong>{formatMoney(spending)}</strong></div>
        <div className="stat"><span>Saldo</span><strong className={saldo < 0 ? "negative" : "positive"}>{formatMoney(saldo)}</strong></div>
        <div className="stat">
          <span>Budget übrig</span>
          <strong className={budgetDelta < 0 ? "negative" : "positive"}>{formatMoney(budgetDelta)}</strong>
          <small>{formatMoney(rangeBudget)} geplant</small>
        </div>
      </section>

      <div className="finance-layout">
        <section className="panel" id="eintrag-erfassen">
          <h2 className="section-title">Eintrag erfassen</h2>
          <form action={createExpense} className="form">
            <label>
              Art
              <select name="kind" defaultValue="EXPENSE">
                <option value="EXPENSE">Ausgabe</option>
                <option value="INCOME">Einnahme</option>
              </select>
            </label>
            <label>
              Betrag in EUR
              <input name="amount" inputMode="decimal" placeholder="42,50" required />
            </label>
            <label>
              Datum
              <input name="date" type="date" defaultValue={toDateInputValue(new Date())} required />
            </label>
            <label>
              Kategorie
              <select name="categoryId" defaultValue="">
                <option value="">Keine Kategorie</option>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              Beschreibung
              <input name="description" placeholder="Wocheneinkauf, Gehalt, Rückerstattung ..." required />
            </label>
            <ScopeSelect />
            <fieldset className="fieldset">
              <legend>Dokument optional verknüpfen</legend>
              <label>Dokumenttitel<input name="documentTitle" placeholder="Rechnung, Beleg, Nachweis ..." /></label>
              <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://..." /></label>
              <label>
                Linktyp
                <select name="documentReferenceType" defaultValue="SYNOLOGY_HTTPS">
                  <option value="SYNOLOGY_HTTPS">Synology HTTPS</option>
                  <option value="WEBDAV_HTTPS">WebDAV HTTPS</option>
                  <option value="EXTERNAL_URL">Externer Link</option>
                </select>
              </label>
            </fieldset>
            <button className="button" type="submit">Speichern</button>
          </form>

          <h2 className="section-title spacing-top">Kategorie hinzufügen</h2>
          <form action={createCategory} className="form compact" id="kategorie-erfassen">
            <input type="hidden" name="type" value="EXPENSE" />
            <label>Name<input name="name" placeholder="Schule, Urlaub, Kindergeld ..." required /></label>
            <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" placeholder="250,00" /></label>
            <label>Farbe automatisch oder wählen<input name="color" type="color" defaultValue="#2f6fed" /></label>
            <ScopeSelect />
            <button className="button secondary" type="submit">Kategorie speichern</button>
          </form>

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
                  <ScopeSelect defaultValue={category.scope} />
                  <button className="button secondary" type="submit">Änderungen speichern</button>
                </form>
              </details>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 className="section-title">Auswertung im Zeitraum</h2>
          <div className="analysis-grid">
            <div>
              <h3>Kategorien</h3>
              <div className="list">
                {categoryRows.length === 0 ? <EmptyState>Noch keine Ausgaben im Zeitraum.</EmptyState> : null}
                {categoryRows.map((row) => (
                  <div className="analysis-row" key={row.name}>
                    <div>
                      <strong>{row.name}</strong>
                      <br />
                      <span className="muted">{row.percent.toFixed(1)}% der Ausgaben · Budget {formatMoney(row.budget)}</span>
                    </div>
                    <div className="bar-stack">
                      <div className="bar-wrap" aria-label={`Ausgabenanteil ${row.name}`}><span style={{ width: `${row.percent}%`, background: row.color }} /></div>
                      <div className="bar-wrap budget-bar" aria-label={`Budgetnutzung ${row.name}`}><span style={{ width: `${row.budgetUsage}%`, background: row.color }} /></div>
                    </div>
                    <div className="amount-column compact-amount">
                      <strong>{formatMoney(row.amount)}</strong>
                      <small className={row.remaining < 0 ? "negative" : "positive"}>{row.remaining < 0 ? "drüber " : "frei "}{formatMoney(Math.abs(row.remaining))}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Monatsübersicht</h3>
              <MiniTable rows={monthlyRows} />
            </div>
            <div>
              <h3>Jahresübersicht</h3>
              <MiniTable rows={yearlyRows} />
            </div>
          </div>
        </section>
      </div>

      <section className="panel spacing-top expense-section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Einträge</h2>
            <p className="muted">Chronologisch kompakt. Antippen öffnet Details, Dokumente und Aktionen.</p>
          </div>
          <span className="badge">Jahressaldo {formatMoney(sumByKind(currentYearEntries, "INCOME") - sumByKind(currentYearEntries, "EXPENSE"))}</span>
        </div>
        <div className="expense-list">
          {expenses.length === 0 ? <EmptyState>Noch keine Einträge erfasst.</EmptyState> : null}
          {expenses.map((expense) => {
            const linkedDocuments = documentsByExpense[expense.id] ?? [];
            return (
              <details className="expense-row" key={expense.id}>
                <summary>
                  <span>{formatDate(expense.date)}</span>
                  <span>{expense.category?.name ?? "Ohne Kategorie"}</span>
                  <strong className={expense.kind === "INCOME" ? "positive" : "negative"}>
                    {expense.kind === "INCOME" ? "+" : "-"}{formatMoney(expense.amountCents, expense.currency)}
                  </strong>
                </summary>
                <div className="expense-detail">
                  <div>
                    <strong>{expense.description}</strong>
                    <span className="muted">{expense.owner.name} · {expense.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                  </div>
                  <div className="badge-row">
                    <span className="badge">{expense.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</span>
                    {linkedDocuments.length === 0 ? <span className="badge">Kein Dokument</span> : null}
                    {linkedDocuments.map((document) => (
                      <a className="badge link-badge" href={document.url} key={document.id} target="_blank" rel="noreferrer">
                        {document.title}
                      </a>
                    ))}
                  </div>
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={expense.id} />
                    <button className="button secondary" type="submit">Löschen</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </>
  );
}

function MiniTable({ rows }: { rows: PeriodRow[] }) {
  if (rows.length === 0) return <EmptyState>Noch keine Daten vorhanden.</EmptyState>;
  return (
    <div className="mini-table">
      <div className="mini-table-head"><span>Zeitraum</span><span>Einnahmen</span><span>Ausgaben</span><span>Budget</span><span>Saldo</span></div>
      {rows.map((row) => (
        <div className="mini-table-row" key={row.label}>
          <span>{row.label}</span>
          <span>{formatMoney(row.income)}</span>
          <span>{formatMoney(row.spending)}</span>
          <span>{formatMoney(row.budget)}</span>
          <strong className={row.saldo < 0 ? "negative" : "positive"}>{formatMoney(row.saldo)}</strong>
        </div>
      ))}
    </div>
  );
}

function getRange(from?: string, to?: string) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  defaultTo.setHours(23, 59, 59, 999);

  return {
    from: from ? new Date(from) : defaultFrom,
    to: to ? endOfDay(new Date(to)) : defaultTo
  };
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

function buildCategoryRows(entries: ExpenseLike[], categories: CategoryLike[], totalSpending: number, range: { from: Date; to: Date }) {
  const rows = new Map<string, { amount: number; color: string; category?: CategoryLike }>();
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE") continue;
    const name = entry.category?.name ?? "Ohne Kategorie";
    const current = rows.get(name) ?? {
      amount: 0,
      color: entry.category?.color ?? "#6b6f76",
      category: entry.category ?? undefined
    };
    current.amount += entry.amountCents;
    rows.set(name, current);
  }
  for (const category of categories) {
    if (category.monthlyBudgetCents <= 0 || rows.has(category.name)) continue;
    rows.set(category.name, { amount: 0, color: category.color, category });
  }

  return [...rows.entries()]
    .map(([name, row]) => {
      const budget = categoryBudgetForRange(row.category, range.from, range.to);
      return {
        name,
        amount: row.amount,
        color: row.color,
        budget,
        remaining: budget - row.amount,
        budgetUsage: budget > 0 ? Math.min(100, (row.amount / budget) * 100) : 0,
        percent: totalSpending > 0 ? (row.amount / totalSpending) * 100 : 0
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

type PeriodRow = {
  label: string;
  income: number;
  spending: number;
  budget: number;
  saldo: number;
};

function buildPeriodRows(entries: ExpenseLike[], categories: CategoryLike[], mode: "month" | "year"): PeriodRow[] {
  const rows = new Map<string, PeriodRow>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const label = mode === "month"
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : String(date.getFullYear());
    const row = rows.get(label) ?? {
      label,
      income: 0,
      spending: 0,
      budget: budgetForPeriod(categories, mode),
      saldo: 0
    };
    if (entry.kind === "INCOME") row.income += entry.amountCents;
    if (entry.kind === "EXPENSE") row.spending += entry.amountCents;
    row.saldo = row.income - row.spending;
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => b.label.localeCompare(a.label)).slice(0, 12);
}

function budgetForPeriod(categories: CategoryLike[], mode: "month" | "year") {
  const monthlyBudget = categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0);
  return mode === "year" ? monthlyBudget * 12 : monthlyBudget;
}

function budgetForRange(categories: CategoryLike[], from: Date, to: Date) {
  const monthlyBudget = categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0);
  if (monthlyBudget === 0) return 0;
  let total = 0;
  for (let cursor = new Date(from.getFullYear(), from.getMonth(), 1); cursor <= to; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    const overlapStart = new Date(Math.max(from.getTime(), monthStart.getTime()));
    const overlapEnd = new Date(Math.min(to.getTime(), monthEnd.getTime()));
    if (overlapStart <= overlapEnd) {
      const daysInMonth = monthEnd.getDate();
      const coveredDays = Math.floor((startOfDay(overlapEnd).getTime() - startOfDay(overlapStart).getTime()) / 86400000) + 1;
      total += Math.round((monthlyBudget / daysInMonth) * coveredDays);
    }
  }
  return total;
}

function categoryBudgetForRange(category: CategoryLike | undefined, from: Date, to: Date) {
  return category ? budgetForRange([category], from, to) : 0;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

type ExpenseLike = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
type CategoryLike = Awaited<ReturnType<typeof getVisibleCategories>>[number];
