import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";

type ExpenseFilterFormProps = {
  params: ExpenseFilterParams;
  categories: { id: string; name: string }[];
  labels: { id: string; name: string }[];
};

export function ExpenseFilterForm({ params, categories, labels }: ExpenseFilterFormProps) {
  return (
    <form action="/ausgaben" className="form form-grid expense-filter-form" method="get">
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {params.year ? <input type="hidden" name="year" value={params.year} /> : null}
      {params.month ? <input type="hidden" name="month" value={params.month} /> : null}
      {params.compareA ? <input type="hidden" name="compareA" value={params.compareA} /> : null}
      {params.compareB ? <input type="hidden" name="compareB" value={params.compareB} /> : null}
      <fieldset className="fieldset full-span compact-fieldset">
        <legend>Zeitraum optional eingrenzen</legend>
        <div className="form-grid">
          <label>Von<input name="from" type="date" defaultValue={params.from ?? ""} /></label>
          <label>Bis<input name="to" type="date" defaultValue={params.to ?? ""} /></label>
        </div>
      </fieldset>
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
        <a className="button secondary" href={buildExpensesHref(params, { q: undefined, category: undefined, label: undefined, from: undefined, to: undefined })}>Filter löschen</a>
      </div>
    </form>
  );
}
