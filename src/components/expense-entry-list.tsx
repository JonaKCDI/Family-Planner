"use client";

import { PaymentMethodField } from "@/components/payment-method-field";

import { DocumentFilePicker } from "@/components/document-file-picker";
import { Car } from "lucide-react";
import { useState } from "react";
import { createExpense, deleteExpense, quickCreateExpenseCategory, quickCreateExpenseLabel, updateExpense } from "@/lib/actions";
import type { ExpenseDocumentItem, ExpenseListItem } from "@/lib/expense-list";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";

export type ExpenseEntryOption = {
  id: string;
  name: string;
  color?: string;
  icon?: string | null;
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
  documentRoots: { id: string; name: string }[];
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
  documentRoots,
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
  if (currentState !== state) setState(currentState);

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
          documentRoots={documentRoots}
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
  documentRoots,
  contracts,
  returnTo
}: {
  expense: ExpenseListItem;
  linkedDocuments: ExpenseDocumentItem[];
  duplicateCount: number;
  categories: ExpenseEntryOption[];
  labels: ExpenseEntryOption[];
  documentRoots: { id: string; name: string }[];
  contracts: ExpenseEntryContractOption[];
  returnTo: string;
}) {
  const [mode, setMode] = useState<"read" | "edit" | "duplicate" | "delete">("read");
  const primaryDocument = linkedDocuments[0];
  const categoryOptions = includeSelectedOption(categories, expense.category ? { id: expense.category.id, name: expense.category.name, color: expense.category.color, icon: expense.category.icon } : null);
  const labelOptions = includeSelectedOption(labels, expense.label ? { id: expense.label.id, name: expense.label.name, meta: "archiviert" } : null);
  const overviewMeta = [expense.store, expense.paymentMethod].filter(isUsefulExpenseMeta);
  const source = expense.generatedByFuelEntry || expense.fuelEntry
    ? "Tankstopp"
    : expense.recurringTransaction
      ? "Serie"
      : expense.generatedByContract || expense.contract
        ? "Vertrag"
        : "Manuell erfasst";
  const amountPrefix = expense.kind === "INCOME" ? "+" : "-";

  return (
    <ActionModal
      title={mode === "read" ? "Buchungsdetails" : mode === "edit" ? "Buchung bearbeiten" : mode === "duplicate" ? "Buchung duplizieren" : "Buchung löschen"}
      trigger={(
        <span className="expense-row-summary">
          <span className="expense-summary-copy">
            <span className="expense-summary-date">{formatDate(expense.date)}</span>
            <span className="expense-summary-main">{expense.description || "Ohne Beschreibung"}</span>
          </span>
          <span className={expense.kind === "INCOME" ? "positive expense-summary-amount" : "negative expense-summary-amount"}>
            {amountPrefix}{formatMoney(expense.amountCents, expense.currency)}
          </span>
          <span className="expense-mobile-tags">
            <span className="overview-tag expense-category-tag" style={expense.category ? { borderColor: expense.category.color } : undefined}>
              {expense.category ? <CategoryIcon icon={expense.category.icon} size={14} /> : null}
              {expense.category?.name ?? "Ohne Kategorie"}
            </span>
            {overviewMeta.map((item, index) => <span className="overview-tag meta-overview-tag" key={`${item}-${index}`}>{item}</span>)}
            {expense.label ? <span className="overview-tag label-overview-tag" style={{ background: expense.label.color }}>{expense.label.name}</span> : null}
            {source !== "Manuell erfasst" ? <span className="overview-tag source-tag">{source}</span> : null}
            {duplicateCount > 1 ? <span className="overview-tag duplicate-tag">Mögliches Duplikat</span> : null}
          </span>
        </span>
      )}
      triggerClassName="expense-row-trigger"
      modalId={`expense-${expense.id}`}
      panelClassName="expense-detail-sheet sheet-large"
      wide
    >
      {mode === "read" ? (
        <div className="expense-detail-read">
          <div className="expense-detail-hero">
            <span className="expense-detail-icon" style={expense.category ? { background: expense.category.color } : undefined} aria-hidden="true">
              {expense.category ? <CategoryIcon icon={expense.category.icon} size={24} /> : "€"}
            </span>
            <div>
              <h3>{expense.description || "Ohne Beschreibung"}</h3>
              <strong className={expense.kind === "INCOME" ? "positive" : "negative"}>{amountPrefix}{formatMoney(expense.amountCents, expense.currency)}</strong>
              <time>{formatDate(expense.date)}</time>
            </div>
          </div>
          <dl className="expense-detail-list">
            <div><dt>Art</dt><dd>{expense.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</dd></div>
            <div><dt>Kategorie</dt><dd>{expense.category?.name ?? "Ohne Kategorie"}</dd></div>
            <div><dt>Zahlungsart</dt><dd>{isUsefulExpenseMeta(expense.paymentMethod) ? expense.paymentMethod : "Nicht angegeben"}</dd></div>
            <div><dt>Geschäft</dt><dd>{expense.store || "Nicht angegeben"}</dd></div>
            <div><dt>Label / Projekt</dt><dd>{expense.label?.name ?? "Kein Label"}</dd></div>
            <div><dt>Quelle</dt><dd>{source}{expense.recurringTransaction ? `: ${expense.recurringTransaction.title}` : ""}</dd></div>
            <div><dt>Vertrag</dt><dd>{expense.contract ? `${expense.contract.provider} · ${expense.contract.contractType}` : "Keine Vertragsverknüpfung"}</dd></div>
            <div><dt>Dokumente</dt><dd>{linkedDocuments.length === 0 ? "Kein Dokument" : linkedDocuments.map((document) => document.title).join(", ")}</dd></div>
          </dl>
          {expense.fuelEntry ? <FuelEntryTag expense={expense} variant="detail" /> : null}
          {duplicateCount > 1 ? <span className="badge duplicate-badge">{duplicateCount} ähnliche Einträge im Zeitraum</span> : null}
          <div className="modal-submit-row modal-footer expense-detail-actions">
            <button className="button secondary" type="button" onClick={() => setMode("edit")}>Bearbeiten</button>
            <button className="button" type="button" onClick={() => setMode("duplicate")}>Duplizieren</button>
          </div>
          <details className="expense-overflow-actions">
            <summary>Weitere Aktionen</summary>
            <button className="button secondary danger-subtle" type="button" onClick={() => setMode("delete")}>Löschen</button>
          </details>
        </div>
      ) : null}

      {mode === "edit" || mode === "duplicate" ? (
        <ExpenseMutationForm
          action={mode === "edit" ? updateExpense : createExpense}
          expense={expense}
          categories={categoryOptions}
          labels={labelOptions}
          documentRoots={documentRoots}
          contracts={contracts}
          primaryDocument={mode === "edit" ? primaryDocument : undefined}
          returnTo={returnTo}
          submitLabel={mode === "edit" ? "Speichern" : "Duplikat speichern"}
          statusKey={`${mode}-${expense.id}`}
          onBack={() => setMode("read")}
        />
      ) : null}

      {mode === "delete" ? (
        <div className="expense-delete-confirm">
          <p>Diese Buchung wirklich löschen?</p>
          <div className="modal-submit-row modal-footer">
            <button className="button secondary" type="button" onClick={() => setMode("read")}>Zurück</button>
            <form action={deleteExpense}>
              <input type="hidden" name="id" value={expense.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <ConfirmSubmitButton title="Buchung löschen?" message="Diese Buchung wird dauerhaft aus deinen Ausgaben entfernt." className="button danger-subtle">Löschen</ConfirmSubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </ActionModal>
  );
}

function ExpenseMutationForm({
  action,
  expense,
  categories,
  labels,
  documentRoots,
  contracts,
  primaryDocument,
  returnTo,
  submitLabel,
  statusKey,
  onBack
}: {
  action: typeof updateExpense | typeof createExpense;
  expense: ExpenseListItem;
  categories: SearchableSelectOption[];
  labels: SearchableSelectOption[];
  documentRoots: { id: string; name: string }[];
  contracts: ExpenseEntryContractOption[];
  primaryDocument?: ExpenseDocumentItem;
  returnTo: string;
  submitLabel: string;
  statusKey: string;
  onBack: () => void;
}) {
  return (
    <AutosaveForm action={action} className="form form-grid modal-form expense-sheet-form" statusKey={statusKey}>
      {action === updateExpense ? <input type="hidden" name="id" value={expense.id} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />
      <fieldset className="fieldset modal-form-section full-span">
        <legend>Kernangaben</legend>
        <div className="finance-kind-toggle" role="radiogroup" aria-label="Art der Buchung">
          <label><input name="kind" type="radio" value="EXPENSE" defaultChecked={expense.kind === "EXPENSE"} />Ausgabe</label>
          <label><input name="kind" type="radio" value="INCOME" defaultChecked={expense.kind === "INCOME"} />Einnahme</label>
        </div>
        <div className="form-grid">
          <label className="full-span">Beschreibung<input name="description" defaultValue={expense.description} required /></label>
          <label>Betrag in EUR<input name="amount" inputMode="decimal" defaultValue={formatEuroInput(expense.amountCents)} required /></label>
          <label>Datum<input name="date" type="date" defaultValue={toDateInputValue(expense.date)} required /></label>
          <SearchableSelect name="categoryId" label="Kategorie" options={categories} defaultValue={expense.categoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
          <PaymentMethodField defaultValue={expense.paymentMethod} />
        </div>
      </fieldset>
      <details className="optional-section full-span" open>
        <summary>Weitere Optionen</summary>
        <div className="form-grid">
          <label>Geschäft / Anbieter<input name="store" defaultValue={expense.store} placeholder="Rewe, Lidl, Amazon ..." /></label>
          <SearchableSelect name="labelId" label="Label / Projekt" options={labels} defaultValue={expense.labelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
          <label>
            Vertrag
            <select name="contractId" defaultValue={expense.contractId ?? ""}>
              <option value="">Kein Vertrag</option>
              {contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.provider} · {contract.contractType}</option>)}
            </select>
          </label>
          <label>Sichtbarkeit<select name="scope" defaultValue="PRIVATE"><option value="PRIVATE">Privat</option><option value="FAMILY">Familie</option></select></label>
        </div>
      </details>
      <details className="optional-section full-span" open={Boolean(primaryDocument)}>
        <summary>Beleg / Dokument</summary>
        <input type="hidden" name="documentId" value={primaryDocument?.id ?? ""} />
          {primaryDocument && !primaryDocument.url ? <p className="muted full-span">Verknüpfte NAS-Datei: {primaryDocument.title}. Weitere Belege können hinzugefügt werden.</p> : null}
        <div className="form-grid">
          <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.url ? primaryDocument.title : ""} placeholder="Rechnung, Beleg, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
        </div>
      </details>
      <DocumentFilePicker roots={documentRoots} />
      <div className="modal-submit-row modal-footer">
        <button className="button secondary" type="button" onClick={onBack}>Zurück</button>
        <button className="button autosave-submit" type="submit">{submitLabel}</button>
      </div>
    </AutosaveForm>
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
