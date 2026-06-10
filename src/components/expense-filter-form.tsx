import { SearchableSelect } from "@/components/searchable-select";
import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { buildMonthSelectOptions, splitMonthKey } from "@/lib/month-options";

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
  const defaultYear = String(selectedMonth?.year ?? (params.year ? Number(params.year) : undefined) ?? currentMonth?.year ?? years[0] ?? new Date().getFullYear());
  const defaultMonth = selectedMonth?.month ?? (!params.month && !params.year && !params.from && !params.to ? currentMonth?.month ?? "" : "");
  const yearOptions = [...new Set([...years, Number(defaultYear)].filter(Number.isFinite))].sort((a, b) => b - a);

  return (
    <form action="/ausgaben" className="form form-grid expense-filter-form" method="get">
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {params.compareA ? <input type="hidden" name="compareA" value={params.compareA} /> : null}
      {params.compareB ? <input type="hidden" name="compareB" value={params.compareB} /> : null}
      <fieldset className="fieldset full-span compact-fieldset period-picker-fieldset">
        <legend>Schnell springen</legend>
        <div className="period-select-row">
          <label>
            Monat
            <select name="month" defaultValue={defaultMonth}>
              <option value="">Ganzes Jahr</option>
              {buildMonthSelectOptions().map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Jahr
            <select name="year" defaultValue={defaultYear}>
              {yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
          </label>
        </div>
        <p className="muted">Mit Monat springst du direkt in die Monatsansicht, ohne Monat in die Jahresansicht.</p>
      </fieldset>
      <fieldset className="fieldset full-span compact-fieldset">
        <legend>Freier Zeitraum optional</legend>
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
