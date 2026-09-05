"use client";

import { useState, type CSSProperties } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { FilterMultiSelect } from "@/components/filter-multi-select";
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

const kindSegmentLabelStyle: CSSProperties = {
  position: "relative",
  minHeight: 48,
  padding: ".55rem .25rem",
  alignItems: "center",
  justifyContent: "center"
};

const kindSegmentInputStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  minWidth: 1,
  height: 1,
  minHeight: 1,
  margin: 0,
  opacity: 0,
  pointerEvents: "none"
};

export function ExpenseFilterForm({ params, categories, labels, years, currentMonthKey, paymentMethods, resultCount, formId, showActions = true }: ExpenseFilterFormProps) {
  const currentMonth = splitMonthKey(currentMonthKey);
  const selectedMonth = splitMonthKey(params.month);
  const defaultYear = String(selectedMonth?.year ?? (params.year ? Number(params.year) : undefined) ?? currentMonth?.year ?? years[0] ?? new Date().getFullYear());
  const defaultMonth = selectedMonth?.month ?? (!params.month && !params.year && !params.from && !params.to ? currentMonth?.month ?? "" : "");
  const yearOptions = [...new Set([...years, Number(defaultYear)].filter(Number.isFinite))].sort((a, b) => b - a);
  const selectedPaymentMethods = normalizeList(params.paymentMethod);
  const selectedSources = normalizeList(params.source);
  const initialRangeMode = params.from || params.to ? "custom" : params.year && !params.month ? "year" : "month";
  const [rangeMode, setRangeMode] = useState<"month" | "year" | "custom">(initialRangeMode);
  const [panel, setPanel] = useState<"main" | "more">("main");
  const [kind, setKind] = useState<"" | "expense" | "income">(params.kind === "expense" || params.kind === "income" ? params.kind : "");

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

      {panel === "more" ? (
        <div className="task-create-subhead full-span finance-filter-subhead">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setPanel("main")}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <strong>Weitere Filter</strong>
          <span aria-hidden="true" />
        </div>
      ) : null}

      <div className="finance-filter-main full-span" hidden={panel !== "main"} style={{ alignContent: "start", alignSelf: "start" }}>
        <fieldset className="fieldset compact-fieldset period-picker-fieldset">
          <legend>Zeitraum</legend>
          <div className="finance-filter-segments finance-filter-mode" aria-label="Zeitraum-Modus">
            <button className={rangeMode === "month" ? "active" : ""} type="button" aria-pressed={rangeMode === "month"} onClick={() => setRangeMode("month")}>Monat</button>
            <button className={rangeMode === "year" ? "active" : ""} type="button" aria-pressed={rangeMode === "year"} onClick={() => setRangeMode("year")}>Jahr</button>
            <button className={rangeMode === "custom" ? "active" : ""} type="button" aria-pressed={rangeMode === "custom"} onClick={() => setRangeMode("custom")}>Eigener Zeitraum</button>
          </div>
          <div className="period-select-row" hidden={rangeMode === "custom"}>
          <label>
            Monat
            <select name="month" defaultValue={defaultMonth} disabled={rangeMode !== "month"}>
              <option value="">Ganzes Jahr</option>
              {buildMonthSelectOptions().map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Jahr
            <select name="year" defaultValue={defaultYear} disabled={rangeMode === "custom"}>
              {yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
          </label>
          </div>
          <div className="form-grid" hidden={rangeMode !== "custom"}>
            <label>Von<input name="from" type="date" defaultValue={params.from ?? ""} disabled={rangeMode !== "custom"} /></label>
            <label>Bis<input name="to" type="date" defaultValue={params.to ?? ""} disabled={rangeMode !== "custom"} /></label>
          </div>
        </fieldset>

        <fieldset className="fieldset compact-fieldset">
          <legend>Art</legend>
          <div className="finance-filter-segments finance-kind-segments" role="radiogroup" aria-label="Buchungsart">
            <label className={!kind ? "active" : ""} style={kindSegmentLabelStyle}><input name="kind" type="radio" value="" checked={!kind} onChange={() => setKind("")} style={kindSegmentInputStyle} />Alle</label>
            <label className={kind === "expense" ? "active" : ""} style={kindSegmentLabelStyle}><input name="kind" type="radio" value="expense" checked={kind === "expense"} onChange={() => setKind("expense")} style={kindSegmentInputStyle} />Ausgaben</label>
            <label className={kind === "income" ? "active" : ""} style={kindSegmentLabelStyle}><input name="kind" type="radio" value="income" checked={kind === "income"} onChange={() => setKind("income")} style={kindSegmentInputStyle} />Einnahmen</label>
          </div>
        </fieldset>

        <FilterMultiSelect name="category" label="Kategorie" options={categories} defaultValue={params.category} emptyLabel="Alle Kategorien" placeholder="Kategorie suchen" />
        <FilterMultiSelect name="label" label="Label / Projekt" options={labels} defaultValue={params.label} emptyLabel="Alle Labels" placeholder="Label suchen" />

        <button className="flow-link finance-more-filters-link" type="button" onClick={() => setPanel("more")}>
          <span>Weitere Filter</span>
          <small>Zahlungsart und Quelle</small>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="finance-filter-more full-span" hidden={panel !== "more"} style={{ alignContent: "start", alignSelf: "start" }}>
        <fieldset className="fieldset compact-fieldset">
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
        <fieldset className="fieldset compact-fieldset">
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
      </div>

      {showActions ? (
        <div className="filter-actions full-span">
          <a className="button secondary" href={buildExpensesHref(params, { q: undefined, category: undefined, label: undefined, kind: undefined, paymentMethod: undefined, source: undefined, from: undefined, to: undefined, month: undefined, year: undefined })}>Zurücksetzen</a>
          <button className="button" type="submit">{resultCount} Einträge anzeigen</button>
        </div>
      ) : null}
    </form>
  );
}
