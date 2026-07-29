import { SearchableSelect } from "@/components/searchable-select";
import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { normalizeList } from "@/lib/expense-filters";
import { buildMonthSelectOptions, splitMonthKey } from "@/lib/month-options";

type ExpenseFilterFormProps = {
  params: ExpenseFilterParams;
  categories: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  years: number[];
  currentMonthKey: string;
  paymentMethods: string[];
  resultCount: number;
  formId?: string;
  showActions?: boolean;
};

const sourceOptions = [
  { value: "manual", label: "Manuell" },
  { value: "contract", label: "Vertrag" },
  { value: "fuel", label: "Tankstopp" },
  { value: "recurring", label: "Serie" }
];

export function ExpenseFilterForm({ params, categories, labels, years, currentMonthKey, paymentMethods, resultCount, formId, showActions = true }: ExpenseFilterFormProps) {
  const currentMonth = splitMonthKey(currentMonthKey);
  const selectedMonth = splitMonthKey(params.month);
  const defaultYear = String(selectedMonth?.year ?? (params.year ? Number(params.year) : undefined) ?? currentMonth?.year ?? years[0] ?? new Date().getFullYear());
  const defaultMonth = selectedMonth?.month ?? (!params.month && !params.year && !params.from && !params.to ? currentMonth?.month ?? "" : "");
  const yearOptions = [...new Set([...years, Number(defaultYear)].filter(Number.isFinite))].sort((a, b) => b - a);
  const selectedPaymentMethods = normalizeList(params.paymentMethod);
  const selectedSources = normalizeList(params.source);

  return (
    <form action="/ausgaben" className="form form-grid expense-filter-form finance-filter-form" id={formId} method="get">
      {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
      {params.compareA ? <input type="hidden" name="compareA" value={params.compareA} /> : null}
      {params.compareB ? <input type="hidden" name="compareB" value={params.compareB} /> : null}
      {params.compareFrom ? <input type="hidden" name="compareFrom" value={params.compareFrom} /> : null}
      {params.compareTo ? <input type="hidden" name="compareTo" value={params.compareTo} /> : null}
      {params.view ? <input type="hidden" name="view" value={params.view} /> : null}

      {params.q ? (
        <div className="active-search-context full-span">
          <span>Aktive Suche: {params.q}</span>
          <a href={buildExpensesHref(params, { q: undefined })} aria-label="Suche entfernen">x</a>
        </div>
      ) : null}

      <fieldset className="fieldset full-span compact-fieldset period-picker-fieldset">
        <legend>Zeitraum</legend>
        <div className="finance-filter-segments" aria-label="Zeitraum-Modus">
          <span className={!params.from && !params.to && (!params.year || Boolean(params.month)) ? "active" : ""}>Monat</span>
          <span className={params.year && !params.month && !params.from && !params.to ? "active" : ""}>Jahr</span>
          <span className={params.from || params.to ? "active" : ""}>Eigener Zeitraum</span>
        </div>
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
      </fieldset>

      <fieldset className="fieldset full-span compact-fieldset">
        <legend>Eigener Zeitraum</legend>
        <div className="form-grid">
          <label>Von<input name="from" type="date" defaultValue={params.from ?? ""} /></label>
          <label>Bis<input name="to" type="date" defaultValue={params.to ?? ""} /></label>
        </div>
      </fieldset>

      <fieldset className="fieldset full-span compact-fieldset">
        <legend>Art</legend>
        <div className="finance-filter-segments finance-kind-segments" role="radiogroup" aria-label="Buchungsart">
          <label className={!params.kind ? "active" : ""}><input name="kind" type="radio" value="" defaultChecked={!params.kind} />Alle</label>
          <label className={params.kind === "expense" ? "active" : ""}><input name="kind" type="radio" value="expense" defaultChecked={params.kind === "expense"} />Ausgaben</label>
          <label className={params.kind === "income" ? "active" : ""}><input name="kind" type="radio" value="income" defaultChecked={params.kind === "income"} />Einnahmen</label>
        </div>
      </fieldset>

      <SearchableSelect name="category" label="Kategorie" options={categories} defaultValue={params.category} emptyLabel="Alle Kategorien" placeholder="Kategorie suchen oder auswählen" />
      <SearchableSelect name="label" label="Label / Projekt" options={labels} defaultValue={params.label} emptyLabel="Alle Labels" placeholder="Label suchen oder auswählen" />

      <fieldset className="fieldset full-span compact-fieldset">
        <legend>Zahlungsarten</legend>
        <div className="finance-check-grid">
          {paymentMethods.length === 0 ? <span className="muted">Noch keine Zahlungsarten vorhanden.</span> : null}
          {paymentMethods.map((method) => (
            <label className="checkbox-chip" key={method}>
              <input name="paymentMethod" type="checkbox" value={method} defaultChecked={selectedPaymentMethods.includes(method)} />
              <span>{method}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset full-span compact-fieldset">
        <legend>Quellen</legend>
        <div className="finance-check-grid">
          {sourceOptions.map((source) => (
            <label className="checkbox-chip" key={source.value}>
              <input name="source" type="checkbox" value={source.value} defaultChecked={selectedSources.includes(source.value)} />
              <span>{source.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {showActions ? (
        <div className="filter-actions full-span">
          <a className="button secondary" href={buildExpensesHref(params, { q: undefined, category: undefined, label: undefined, kind: undefined, paymentMethod: undefined, source: undefined, from: undefined, to: undefined, month: undefined, year: undefined })}>Zurücksetzen</a>
          <button className="button" type="submit">{resultCount} Einträge anzeigen</button>
        </div>
      ) : null}
    </form>
  );
}
