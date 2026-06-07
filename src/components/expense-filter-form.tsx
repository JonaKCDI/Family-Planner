import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { buildMonthSelectOptions, splitMonthKey } from "@/lib/month-options";
import { SearchableSelect } from "@/components/searchable-select";

type ExpenseFilterFormProps = {
  params: ExpenseFilterParams;
  categories: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  years: number[];
  currentMonthKey: string;
};

export function ExpenseFilterForm({ params, categories, labels, years, currentMonthKey }: ExpenseFilterFormProps) {
  const currentMonth = splitMonthKey(currentMonthKey);
  const selectedMonth = splitMonthKey(params.month);
  const defaultYear = String(selectedMonth?.year ?? params.year ?? currentMonth?.year ?? years[0] ?? new Date().getFullYear());
  const monthOptions = buildMonthSelectOptions();

  return (
    <form action="/ausgaben" className="form form-grid expense-filter-form" method="get">
        {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
        {params.compareA ? <input type="hidden" name="compareA" value={params.compareA} /> : null}
        {params.compareB ? <input type="hidden" name="compareB" value={params.compareB} /> : null}
        <fieldset className="fieldset full-span compact-fieldset period-picker-fieldset">
          <legend>Monat/Jahr</legend>
          <div className="period-select-row">
            <label>
              Monat
              <select name="month" defaultValue={selectedMonth?.month ?? ""}>
                <option value="">Kein Monatsfilter</option>
                {monthOptions.map((month) => <option value={month.value} key={month.value}>{month.label}</option>)}
              </select>
            </label>
            <label>
              Jahr
              <select name="year" defaultValue={defaultYear}>
                {years.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset className="fieldset full-span compact-fieldset">
          <legend>Zeitraum optional eingrenzen</legend>
          <div className="form-grid">
            <label>Von<input name="from" type="date" defaultValue={params.from ?? ""} /></label>
            <label>Bis<input name="to" type="date" defaultValue={params.to ?? ""} /></label>
          </div>
        </fieldset>
        <SearchableSelect name="category" label="Kategorie" options={categories} defaultValue={params.category} emptyLabel="Alle Kategorien" placeholder="Kategorie suchen oder auswählen" />
        <SearchableSelect name="label" label="Label" options={labels} defaultValue={params.label} emptyLabel="Alle Labels" placeholder="Label suchen oder auswählen" />
        <div className="filter-actions full-span">
          <button className="button" type="submit">Anwenden</button>
          <a className="button secondary" href={buildExpensesHref(params, { q: undefined, category: undefined, label: undefined, from: undefined, to: undefined, month: undefined, year: undefined })}>Filter löschen</a>
        </div>
      </form>
  );
}
