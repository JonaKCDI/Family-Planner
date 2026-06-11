"use client";

import { Car } from "lucide-react";
import { useState } from "react";
import { deleteExpense, updateExpense } from "@/lib/actions";
import type { ExpenseDocumentItem, ExpenseListItem } from "@/lib/expense-list";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";

export type ExpenseEntryOption = {
  id: string;
  name: string;
  color?: string;
};

export type ExpenseEntryContractOption = {
  id: string;
  provider: string;
  contractType: string;
};

type ExpenseEntryListProps = {
  initialEntries: ExpenseListItem[];
  totalCount: number;
  duplicateCounts?: Record<string, number>;
  categories: ExpenseEntryOption[];
  labels: ExpenseEntryOption[];
  contracts: ExpenseEntryContractOption[];
  initialDocumentsByExpense: Record<string, ExpenseDocumentItem[]>;
  loadUrl: string;
  returnTo: string;
  pageSize?: number;
};

export function ExpenseEntryList({
  initialEntries,
  totalCount,
  duplicateCounts = {},
  categories,
  labels,
  contracts,
  initialDocumentsByExpense,
  loadUrl,
  returnTo,
  pageSize = 100
}: ExpenseEntryListProps) {
  const [state, setState] = useState({
    initialEntries,
    initialDocumentsByExpense,
    entries: initialEntries,
    documentsByExpense: initialDocumentsByExpense,
    loading: false
  });
  const currentState = state.initialEntries === initialEntries && state.initialDocumentsByExpense === initialDocumentsByExpense
    ? state
    : {
      initialEntries,
      initialDocumentsByExpense,
      entries: initialEntries,
      documentsByExpense: initialDocumentsByExpense,
      loading: false
    };
  if (currentState !== state) {
    setState(currentState);
  }
  const { entries, documentsByExpense, loading } = currentState;
  const hasMore = entries.length < totalCount;

  async function loadMore() {
    if (loading || !hasMore) return;
    setState((current) => ({ ...current, loading: true }));
    try {
      const url = new URL(loadUrl, window.location.origin);
      url.searchParams.set("offset", String(entries.length));
      url.searchParams.set("limit", String(pageSize));
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Nachladen fehlgeschlagen.");
      const payload = await response.json() as { entries: ExpenseListItem[]; documentsByExpense: Record<string, ExpenseDocumentItem[]> };
      setState((current) => ({
        ...current,
        entries: [...current.entries, ...payload.entries],
        documentsByExpense: { ...current.documentsByExpense, ...payload.documentsByExpense }
      }));
    } finally {
      setState((current) => ({ ...current, loading: false }));
    }
  }

  return (
    <div className="expense-list">
      {entries.map((expense) => (
        <ExpenseEntryRow
          expense={expense}
          linkedDocuments={documentsByExpense[expense.id] ?? []}
          duplicateCount={duplicateCounts[expense.id] ?? 0}
          categories={categories}
          labels={labels}
          contracts={contracts}
          returnTo={returnTo}
          key={expense.id}
        />
      ))}
      {hasMore ? (
        <button className="button secondary expense-load-more" type="button" onClick={() => void loadMore()} disabled={loading}>
          {loading ? "Lädt ..." : "Mehr laden"}
        </button>
      ) : null}
    </div>
  );
}

function ExpenseEntryRow({
  expense,
  linkedDocuments,
  duplicateCount,
  categories,
  labels,
  contracts,
  returnTo
}: {
  expense: ExpenseListItem;
  linkedDocuments: ExpenseDocumentItem[];
  duplicateCount: number;
  categories: ExpenseEntryOption[];
  labels: ExpenseEntryOption[];
  contracts: ExpenseEntryContractOption[];
  returnTo: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const primaryDocument = linkedDocuments[0];
  const categoryOptions = includeSelectedOption(categories, expense.category ? { id: expense.category.id, name: expense.category.name } : null);
  const labelOptions = includeSelectedOption(labels, expense.label ? { id: expense.label.id, name: expense.label.name, meta: "archiviert" } : null);
  const overviewMeta = [expense.store, expense.paymentMethod].filter(isUsefulExpenseMeta);

  return (
    <details className="expense-row" onToggle={(event) => { if (event.currentTarget.open) setLoaded(true); }}>
      <summary>
        <span className="expense-summary-date">{formatDate(expense.date)}</span>
        <span className="expense-summary-main">
          {expense.description}
          {overviewMeta.length > 0 ? <small>{overviewMeta.join(" · ")}</small> : null}
        </span>
        <span className="expense-overview-tags">
          <span className="overview-tag" style={expense.category ? { borderColor: expense.category.color } : undefined}>
            {expense.category?.name ?? "Ohne Kategorie"}
          </span>
          {expense.label ? <span className="overview-tag label-overview-tag" style={{ background: expense.label.color }}>{expense.label.name}</span> : null}
          {expense.contract ? <span className="overview-tag">{expense.contract.provider}</span> : null}
          {expense.generatedByContract ? <span className="overview-tag source-tag">Auto-Vertrag</span> : null}
          {expense.recurringTransaction ? <span className="overview-tag source-tag">Serie: {expense.recurringTransaction.title}</span> : null}
          {expense.fuelEntry ? <FuelEntryTag expense={expense} variant="overview" /> : null}
          {duplicateCount > 1 ? <span className="overview-tag duplicate-tag">Mögliches Duplikat</span> : null}
        </span>
        <strong className={expense.kind === "INCOME" ? "positive expense-summary-amount" : "negative expense-summary-amount"}>
          {expense.kind === "INCOME" ? "+" : "-"}{formatMoney(expense.amountCents, expense.currency)}
        </strong>
      </summary>
      {loaded ? (
        <div className="expense-detail">
          <div className="expense-detail-meta">
            <span className="badge">{expense.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</span>
            {isUsefulExpenseMeta(expense.paymentMethod) ? <span className="badge">{expense.paymentMethod}</span> : null}
            {expense.store ? <span className="badge">{expense.store}</span> : null}
            {expense.category ? <span className="badge" style={{ borderColor: expense.category.color }}>{expense.category.name}</span> : null}
            {expense.label ? <span className="badge label-badge" style={{ background: expense.label.color }}>{expense.label.name}</span> : null}
            {expense.contract ? <span className="badge">Vertrag: {expense.contract.provider} · {expense.contract.contractType}</span> : null}
            {expense.generatedByContract ? <span className="badge">Automatisch aus Vertrag erstellt</span> : null}
            {expense.recurringTransaction ? <span className="badge">Serie: {expense.recurringTransaction.title}</span> : null}
            {expense.fuelEntry ? <FuelEntryTag expense={expense} variant="detail" /> : null}
            {duplicateCount > 1 ? <span className="badge duplicate-badge">{duplicateCount} ähnliche Einträge im Zeitraum</span> : null}
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
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="button secondary danger-subtle" type="submit">Löschen</button>
            </form>
            <ActionModal title="Eintrag bearbeiten" trigger="Bearbeiten" modalId={`expense-${expense.id}`}>
              <AutosaveForm action={updateExpense} className="form form-grid modal-form" statusKey={`expense-${expense.id}`}>
                <input type="hidden" name="id" value={expense.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <fieldset className="fieldset modal-form-section full-span">
                  <legend>Kernangaben</legend>
                  <div className="form-grid">
                    <label>
                      Art
                      <select name="kind" defaultValue={expense.kind}>
                        <option value="EXPENSE">Ausgabe</option>
                        <option value="INCOME">Einnahme</option>
                      </select>
                    </label>
                    <label>Betrag in EUR<input name="amount" inputMode="decimal" defaultValue={formatEuroInput(expense.amountCents)} required /></label>
                    <label>Datum<input name="date" type="date" defaultValue={toDateInputValue(expense.date)} required /></label>
                  </div>
                </fieldset>
                <fieldset className="fieldset modal-form-section full-span">
                  <legend>Details</legend>
                  <div className="form-grid">
                    <label>Beschreibung<input name="description" defaultValue={expense.description} /></label>
                    <label>Bezahlart<input name="paymentMethod" list="payment-methods" defaultValue={expense.paymentMethod} /></label>
                    <label>Laden<input name="store" defaultValue={expense.store} placeholder="Rewe, Lidl, Amazon ..." /></label>
                  </div>
                </fieldset>
                <fieldset className="fieldset modal-form-section full-span">
                  <legend>Zuordnung</legend>
                  <div className="form-grid">
                    <SearchableSelect name="categoryId" label="Kategorie" options={categoryOptions} defaultValue={expense.categoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
                    <SearchableSelect name="labelId" label="Label / Projekt" options={labelOptions} defaultValue={expense.labelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
                    <label>
                      Vertrag
                      <select name="contractId" defaultValue={expense.contractId ?? ""}>
                        <option value="">Kein Vertrag</option>
                        {contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.provider} · {contract.contractType}</option>)}
                      </select>
                    </label>
                  </div>
                </fieldset>
                <PaymentMethods />
                <details className="optional-section full-span" open={Boolean(primaryDocument)}>
                  <summary>Beleg / Drive-Link hinzufügen</summary>
                  <input type="hidden" name="documentId" value={primaryDocument?.id ?? ""} />
                  <div className="form-grid">
                    <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.title ?? ""} placeholder="Rechnung, Beleg, Nachweis ..." /></label>
                    <label>Drive-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
                  </div>
                </details>
                <button className="button full-span autosave-submit" type="submit">Änderungen speichern</button>
              </AutosaveForm>
            </ActionModal>
          </div>
        </div>
      ) : null}
    </details>
  );
}

function FuelEntryTag({ expense, variant }: { expense: ExpenseListItem; variant: "overview" | "detail" }) {
  if (!expense.fuelEntry) return null;
  const title = `${expense.generatedByFuelEntry ? "Automatisch aus Tankstopp erstellt" : "Verknüpfter Tankstopp"}: ${expense.fuelEntry.car.name}, ${expense.fuelEntry.odometerKm.toLocaleString("de-DE")} km`;
  const className = variant === "overview" ? "overview-tag fuel-entry-tag" : "badge fuel-entry-tag";

  return (
    <span className={className} title={title} aria-label={title}>
      <Car aria-hidden="true" size={17} strokeWidth={2.4} />
      <span className="fuel-entry-copy">
        <span className="fuel-entry-name">{expense.fuelEntry.car.name}</span>
        <span className="fuel-entry-distance">{expense.fuelEntry.odometerKm.toLocaleString("de-DE")} km</span>
      </span>
    </span>
  );
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

function formatEuroInput(amountCents: number) {
  if (amountCents === 0) return "";
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

function includeSelectedOption<T extends SearchableSelectOption>(options: T[], selected: SearchableSelectOption | null) {
  if (!selected || options.some((option) => option.id === selected.id)) return options;
  return [selected, ...options];
}

function isUsefulExpenseMeta(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("de-DE");
  return Boolean(normalized) && normalized !== "nicht angegeben";
}
