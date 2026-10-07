"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, FileText } from "lucide-react";
import { DocumentFilePicker } from "@/components/document-file-picker";
import { PaymentMethodField } from "@/components/payment-method-field";
import { SearchableSelect } from "@/components/searchable-select";
import { quickCreateExpenseCategory, quickCreateExpenseLabel, updateFuelEntry } from "@/lib/actions";
import { formatEuroInputFromCents, formatLitersInput } from "@/lib/mileage";
import { toDateInputValue } from "@/lib/format";
import type { getDocumentsForLinkedEntities, getExpenseLabels, getFuelExpenseSettings, getFuelEntriesForCar, getVisibleCategories } from "@/lib/queries";

type FuelEntry = ReturnType<typeof import("@/lib/mileage").addFuelDerivedFields>[number];
type FuelExpense = NonNullable<Awaited<ReturnType<typeof getFuelEntriesForCar>>[number]["expense"]>;
type LinkedDocument = Awaited<ReturnType<typeof getDocumentsForLinkedEntities>>[number];

export function FuelEntryEditForm({
  entry,
  expense,
  linkedDocument,
  selectedCarId,
  selectedCarName,
  returnTo,
  categories,
  labels,
  documentRoots,
  settings
}: {
  entry: FuelEntry;
  expense: FuelExpense | undefined;
  linkedDocument: LinkedDocument | undefined;
  selectedCarId: string;
  selectedCarName: string;
  returnTo: string;
  categories: Awaited<ReturnType<typeof getVisibleCategories>>;
  labels: Awaited<ReturnType<typeof getExpenseLabels>>;
  documentRoots: { id: string; name: string }[];
  settings: Awaited<ReturnType<typeof getFuelExpenseSettings>>;
}) {
  const [bookExpense, setBookExpense] = useState(Boolean(expense?.generatedByFuelEntry));
  const [sharedWithFamily, setSharedWithFamily] = useState(expense?.sharedWithFamily ?? settings?.sharedWithFamily ?? false);
  const [fuelPanel, setFuelPanel] = useState<"main" | "document">("main");

  return (
    <form action={updateFuelEntry} className="form form-grid modal-form finance-create-form fuel-create-form mileage-edit-form" data-fuel-panel={fuelPanel}>
      <input type="hidden" name="id" value={entry.id} />
      <input type="hidden" name="carId" value={selectedCarId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {fuelPanel === "document" ? (
        <div className="task-create-subhead full-span fuel-create-subhead">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setFuelPanel("main")}><ArrowLeft size={18} aria-hidden="true" /></button>
          <div><strong>Beleg / Dokument</strong></div>
          <span aria-hidden="true" />
        </div>
      ) : null}
      <fieldset className="fieldset modal-form-section full-span finance-create-core fuel-create-core" hidden={fuelPanel !== "main"}>
        <legend>Tankstopp</legend>
        <div className="form-grid finance-create-grid fuel-create-grid">
          <label>Auto<input value={selectedCarName} readOnly /></label>
          <label>Datum<input name="date" type="date" defaultValue={toDateInputValue(entry.date)} required /></label>
          <div className="fuel-measure-row full-span">
            <label>Kilometerstand<input name="odometerKm" type="number" inputMode="numeric" min="0" defaultValue={entry.odometerKm} required /></label>
            <label>Liter<input name="liters" inputMode="decimal" defaultValue={formatLitersInput(entry.litersMilli)} placeholder="45,34" required /></label>
          </div>
          <div className="fuel-booking-row full-span">
            <label>Betrag in EUR<input name="cost" inputMode="decimal" defaultValue={formatEuroInputFromCents(entry.costCents)} placeholder="71,01" required /></label>
            <div className="finance-kind-toggle finance-kind-compact fuel-expense-segment" role="radiogroup" aria-label="Tankstopp als Ausgabe buchen">
              <label><input name="createExpenseFromFuel" type="radio" value="off" checked={!bookExpense} onChange={() => setBookExpense(false)} />Nur Tank</label>
              <label><input name="createExpenseFromFuel" type="radio" value="on" checked={bookExpense} onChange={() => setBookExpense(true)} />Ausgabe</label>
            </div>
          </div>
          <label className="full-span">Bemerkung<input name="note" defaultValue={entry.note} placeholder="Urlaub, bezahlt von ..., Werkstatt ..." /></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span fuel-expense-page" hidden={fuelPanel !== "main"}>
        <legend>Ausgabe</legend>
        {bookExpense ? (
          <div className="form-grid">
            <SearchableSelect name="expenseCategoryId" label="Kategorie" options={categories} defaultValue={expense?.categoryId ?? settings?.defaultCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
            <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} defaultValue={expense?.labelId ?? settings?.defaultLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
            <PaymentMethodField name="expensePaymentMethod" defaultValue={expense?.paymentMethod ?? settings?.defaultPaymentMethod ?? ""} />
            <label>Laden<input name="expenseStore" defaultValue={expense?.store ?? settings?.defaultStore ?? ""} placeholder="Tankstelle oder Händler" /></label>
            <div className="fuel-description-share-row full-span">
              <label>Beschreibung<input name="expenseDescription" defaultValue={expense?.description ?? settings?.defaultDescription ?? ""} /></label>
              <label className="finance-share-field finance-inline-share-field" data-active={sharedWithFamily ? "true" : "false"}><input aria-label="Familie teilen" type="checkbox" name="sharedWithFamily" checked={sharedWithFamily} onChange={(event) => setSharedWithFamily(event.target.checked)} /><span>Familie teilen</span></label>
            </div>
          </div>
        ) : null}
      </fieldset>
      {bookExpense ? (
        <fieldset className="fieldset modal-form-section full-span task-create-options-page finance-document-page fuel-document-page" hidden={fuelPanel !== "document"}>
          <legend>Beleg / Dokument</legend>
          <div className="form-grid">
            {linkedDocument ? <input type="hidden" name="documentId" value={linkedDocument.id} /> : null}
            {linkedDocument && !linkedDocument.url ? <p className="muted full-span">Verknüpfte NAS-Datei: {linkedDocument.title}. Weitere Belege können hinzugefügt werden.</p> : null}
            <label>Dokumenttitel<input name="documentTitle" defaultValue={linkedDocument?.url ? linkedDocument.title : ""} placeholder="Rechnung, Beleg, Nachweis ..." /></label>
            <label>HTTPS-Link<input name="documentUrl" type="url" defaultValue={linkedDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
            <DocumentFilePicker roots={documentRoots} />
          </div>
        </fieldset>
      ) : null}
      <div className="finance-create-actions fuel-create-actions full-span" hidden={fuelPanel !== "main"}>
        {bookExpense ? <button className="flow-link" type="button" onClick={() => setFuelPanel("document")}><FileText size={18} aria-hidden="true" /><span>Beleg verknüpfen</span><ChevronRight size={18} aria-hidden="true" /></button> : null}
      </div>
      <div className="modal-submit-row modal-footer">
        {fuelPanel === "main" ? <button className="button full-span" type="submit">Tankstopp speichern</button> : <button className="button full-span" type="button" onClick={() => setFuelPanel("main")}>Übernehmen</button>}
      </div>
      {fuelPanel === "document" ? <div className="document-line-art" aria-hidden="true" /> : null}
    </form>
  );
}
