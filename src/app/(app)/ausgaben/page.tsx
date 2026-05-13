import { createExpense, deleteExpense } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { getVisibleCategories, getVisibleExpenses } from "@/lib/queries";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

export default async function ExpensesPage() {
  const session = await requireSession();
  const [expenses, categories] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE")
  ]);

  const now = new Date();
  const currentMonth = expenses.filter((expense) => {
    const date = new Date(expense.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const totalMonth = currentMonth.reduce((sum, expense) => sum + expense.amountCents, 0);
  const totalYear = expenses
    .filter((expense) => new Date(expense.date).getFullYear() === now.getFullYear())
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const privateCount = expenses.filter((expense) => expense.scope === "PRIVATE").length;

  return (
    <>
      <PageHeader title="Ausgaben" description="Manuelle Erfassung, Kategorien und erste Monats-/Jahresauswertungen." />
      <section className="stats">
        <div className="stat"><span>Dieser Monat</span><strong>{formatMoney(totalMonth)}</strong></div>
        <div className="stat"><span>Dieses Jahr</span><strong>{formatMoney(totalYear)}</strong></div>
        <div className="stat"><span>Eintraege</span><strong>{expenses.length}</strong></div>
        <div className="stat"><span>Privat</span><strong>{privateCount}</strong></div>
      </section>
      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Ausgabe erfassen</h2>
          <form action={createExpense} className="form">
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
              <input name="description" placeholder="Wocheneinkauf, Bahn, Versicherung ..." required />
            </label>
            <ScopeSelect />
            <button className="button" type="submit">Speichern</button>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">Letzte Ausgaben</h2>
          <div className="list">
            {expenses.length === 0 ? <EmptyState>Noch keine Ausgaben erfasst.</EmptyState> : null}
            {expenses.map((expense) => (
              <article className="card row" key={expense.id}>
                <div>
                  <strong>{expense.description}</strong>
                  <span className="muted">{formatDate(expense.date)} · {expense.category?.name ?? "Ohne Kategorie"} · {expense.owner.name}</span>
                  <div><span className="badge">{expense.scope === "FAMILY" ? "Familie" : "Privat"}</span></div>
                </div>
                <div>
                  <strong>{formatMoney(expense.amountCents, expense.currency)}</strong>
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={expense.id} />
                    <button className="button secondary" type="submit">Loeschen</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
