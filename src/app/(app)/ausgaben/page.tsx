import { createCategory, createExpense, deleteExpense } from "@/lib/actions";
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

  const income = sumByKind(selectedEntries, "INCOME");
  const spending = sumByKind(selectedEntries, "EXPENSE");
  const saldo = income - spending;
  const currentYearEntries = expenses.filter((entry) => new Date(entry.date).getFullYear() === new Date().getFullYear());
  const categoryRows = buildCategoryRows(selectedEntries, spending);
  const monthlyRows = buildPeriodRows(selectedEntries, "month");
  const yearlyRows = buildPeriodRows(expenses, "year");

  return (
    <>
      <PageHeader title="Ausgaben & Einnahmen" description="Erfassen, kategorisieren und auswerten: Zeitraum, Kategorien, Verteilung und Saldo." />
      <section className="panel">
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
        <div className="stat"><span>Dieses Jahr</span><strong>{formatMoney(sumByKind(currentYearEntries, "INCOME") - sumByKind(currentYearEntries, "EXPENSE"))}</strong></div>
      </section>

      <div className="grid two">
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
            <label>Farbe<input name="color" type="color" defaultValue="#2f6fed" /></label>
            <ScopeSelect />
            <button className="button secondary" type="submit">Kategorie speichern</button>
          </form>
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
                      <span className="muted">{row.percent.toFixed(1)}% der Ausgaben</span>
                    </div>
                    <div className="bar-wrap" aria-hidden="true"><span style={{ width: `${row.percent}%`, background: row.color }} /></div>
                    <strong>{formatMoney(row.amount)}</strong>
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

      <section className="panel spacing-top">
        <h2 className="section-title">Letzte Einträge</h2>
        <div className="list">
          {expenses.length === 0 ? <EmptyState>Noch keine Einträge erfasst.</EmptyState> : null}
          {expenses.map((expense) => {
            const linkedDocuments = documentsByExpense[expense.id] ?? [];
            return (
              <article className="card row" key={expense.id}>
                <div>
                  <strong>{expense.description}</strong>
                  <span className="muted">
                    {formatDate(expense.date)} · {expense.category?.name ?? "Ohne Kategorie"} · {expense.owner.name}
                  </span>
                  <div className="badge-row">
                    <span className="badge">{expense.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</span>
                    <span className="badge">{expense.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                    {linkedDocuments.map((document) => (
                      <a className="badge link-badge" href={document.url} key={document.id} target="_blank" rel="noreferrer">
                        {document.title}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="amount-column">
                  <strong className={expense.kind === "INCOME" ? "positive" : "negative"}>
                    {expense.kind === "INCOME" ? "+" : "-"}{formatMoney(expense.amountCents, expense.currency)}
                  </strong>
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={expense.id} />
                    <button className="button secondary" type="submit">Löschen</button>
                  </form>
                </div>
              </article>
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
      <div className="mini-table-head"><span>Zeitraum</span><span>Einnahmen</span><span>Ausgaben</span><span>Saldo</span></div>
      {rows.map((row) => (
        <div className="mini-table-row" key={row.label}>
          <span>{row.label}</span>
          <span>{formatMoney(row.income)}</span>
          <span>{formatMoney(row.spending)}</span>
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

function buildCategoryRows(entries: ExpenseLike[], totalSpending: number) {
  const rows = new Map<string, { amount: number; color: string }>();
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE") continue;
    const name = entry.category?.name ?? "Ohne Kategorie";
    const current = rows.get(name) ?? { amount: 0, color: entry.category?.color ?? "#6b6f76" };
    current.amount += entry.amountCents;
    rows.set(name, current);
  }

  return [...rows.entries()]
    .map(([name, row]) => ({
      name,
      amount: row.amount,
      color: row.color,
      percent: totalSpending > 0 ? (row.amount / totalSpending) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

type PeriodRow = {
  label: string;
  income: number;
  spending: number;
  saldo: number;
};

function buildPeriodRows(entries: ExpenseLike[], mode: "month" | "year"): PeriodRow[] {
  const rows = new Map<string, PeriodRow>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const label = mode === "month"
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : String(date.getFullYear());
    const row = rows.get(label) ?? { label, income: 0, spending: 0, saldo: 0 };
    if (entry.kind === "INCOME") row.income += entry.amountCents;
    if (entry.kind === "EXPENSE") row.spending += entry.amountCents;
    row.saldo = row.income - row.spending;
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => b.label.localeCompare(a.label)).slice(0, 12);
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

type ExpenseLike = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
