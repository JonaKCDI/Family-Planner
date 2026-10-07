"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Repeat2, ScrollText } from "lucide-react";
import { DocumentFilePicker } from "@/components/document-file-picker";
import { SearchableSelect } from "@/components/searchable-select";
import { quickCreateExpenseCategory, quickCreateExpenseLabel, updateContract } from "@/lib/actions";
import { toAnnualCancellationInputValue } from "@/lib/contracts";
import { toDateInputValue } from "@/lib/format";

type ContractEditData = {
  id: string;
  provider: string;
  contractType: string;
  startDate: Date;
  costCents: number;
  billingInterval: "MONTHLY" | "YEARLY" | "QUARTERLY" | "ONCE" | "OTHER";
  status: "ACTIVE" | "DRAFT" | "CANCELLED" | "EXPIRED";
  scope: "FAMILY" | "PRIVATE";
  autoCreateExpenses: boolean;
  expenseSharedWithFamily: boolean;
  expensePaymentDay: number | null;
  expenseCategoryId: string | null;
  expenseLabelId: string | null;
  endDate: Date | null;
  cancellationDeadlineMonth: number | null;
  cancellationDeadlineDay: number | null;
  cancellationNoticeDays: number | null;
  renewalAnchorDay: number | null;
  autoRenewal: boolean;
  renewalInterval: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONCE" | "OTHER";
  description: string | null;
};

type DocumentLike = {
  id: string;
  title: string;
  url: string;
};

export function ContractEditForm({
  contract,
  categories,
  labels,
  documentRoots,
  primaryDocument,
  currentPriceValidFrom
}: {
  contract: ContractEditData;
  categories: { id: string; name: string; color: string; icon: string }[];
  labels: { id: string; name: string }[];
  documentRoots: { id: string; name: string }[];
  primaryDocument: DocumentLike | undefined;
  currentPriceValidFrom: Date;
}) {
  const [panel, setPanel] = useState<"main" | "auto" | "term" | "document">("main");
  const panelTitle = panel === "auto" ? "Automatische Ausgabe" : panel === "term" ? "Laufzeit & Kündigung" : panel === "document" ? "Beleg / Dokument" : null;
  const day = new Date(contract.startDate).getDate();

  return (
    <form action={updateContract} className="form form-grid modal-form task-create-form finance-create-form contract-create-form contract-edit-form" data-task-view={panel === "main" ? "details" : panel} data-contract-panel={panel}>
      <input type="hidden" name="id" value={contract.id} />
      <input type="hidden" name="priceChangeMode" value="NEW_PHASE" />
      <input type="hidden" name="renewalAnchorDay" value={contract.renewalAnchorDay ?? ""} />
      {panelTitle ? (
        <div className="task-create-subhead full-span contract-create-subhead">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setPanel("main")}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div><strong>{panelTitle}</strong></div>
          <span aria-hidden="true" />
        </div>
      ) : null}

      <fieldset className="fieldset modal-form-section full-span task-create-core contract-create-core" id="edit-contract-core" hidden={panel !== "main"}>
        <legend>Vertrag</legend>
        <div className="form-grid contract-create-grid">
          <label className="full-span">Anbieter *<input name="provider" defaultValue={contract.provider} placeholder="Telekom, Allianz, Netflix ..." required /></label>
          <label className="full-span">Vertragsart *<input name="contractType" defaultValue={contract.contractType} placeholder="Mobilfunk, Versicherung, Abo ..." required /></label>
          <div className="contract-date-cost-row full-span">
            <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(contract.startDate)} required /></label>
            <label>Kosten in EUR *<input name="cost" inputMode="decimal" defaultValue={formatEuroInput(contract.costCents)} placeholder="29,99" required /></label>
          </div>
          <div className="contract-rhythm-status-row full-span">
            <label>
              Zahlungsrhythmus
              <select name="billingInterval" defaultValue={contract.billingInterval}><option value="MONTHLY">Monatlich</option><option value="YEARLY">Jährlich</option><option value="QUARTERLY">Quartalsweise</option><option value="ONCE">Einmalig</option><option value="OTHER">Sonstiges</option></select>
            </label>
            <label>Status<select name="status" defaultValue={contract.status}><option value="ACTIVE">Aktiv</option><option value="DRAFT">Entwurf</option><option value="CANCELLED">Gekündigt</option><option value="EXPIRED">Ausgelaufen</option></select></label>
          </div>
          <label className="full-span">Sichtbarkeit<select name="scope" defaultValue={contract.scope}><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
        </div>
      </fieldset>

      <div className="finance-create-actions contract-flow-links full-span" hidden={panel !== "main"}>
        <button className="flow-link" type="button" onClick={() => setPanel("auto")}><Repeat2 size={17} aria-hidden="true" /><span>Automatische Ausgabe</span><ChevronRight size={17} aria-hidden="true" /></button>
        <button className="flow-link" type="button" onClick={() => setPanel("term")}><ScrollText size={17} aria-hidden="true" /><span>Laufzeit & Kündigung</span><ChevronRight size={17} aria-hidden="true" /></button>
        <button className="flow-link" type="button" onClick={() => setPanel("document")}><FileText size={17} aria-hidden="true" /><span>Beleg / Dokument</span><ChevronRight size={17} aria-hidden="true" /></button>
      </div>
      <label className="full-span" hidden={panel !== "main"}>Notizen<textarea name="description" defaultValue={contract.description ?? ""} /></label>

      <fieldset className="fieldset modal-form-section full-span task-create-options-page contract-auto-page" id="edit-contract-auto" hidden={panel !== "auto"}>
        <legend>Automatische Ausgabe</legend>
        <div className="form-grid">
          <div className="contract-auto-action-row full-span">
            <label className="finance-share-field" data-active={contract.autoCreateExpenses ? "true" : "false"}><input aria-label="Automatische Ausgabe" name="autoCreateExpenses" type="checkbox" defaultChecked={contract.autoCreateExpenses} /><span>Automatische Ausgabe</span></label>
            <label className="finance-share-field" data-active={contract.expenseSharedWithFamily ? "true" : "false"}><input aria-label="Familie teilen" name="expenseSharedWithFamily" type="checkbox" defaultChecked={contract.expenseSharedWithFamily} /><span>Familie teilen</span></label>
          </div>
          <label>Einzugstag<input name="expensePaymentDay" type="number" min="1" max="31" defaultValue={contract.expensePaymentDay ?? day} /></label>
          <SearchableSelect name="expenseCategoryId" label="Ausgaben-Kategorie" options={categories} defaultValue={contract.expenseCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
          <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} defaultValue={contract.expenseLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
          <label>Preis gilt ab<input name="priceValidFrom" type="date" defaultValue={toDateInputValue(currentPriceValidFrom)} required /></label>
          <label className="checkbox-field contract-price-sync-toggle"><input name="updateGeneratedExpenses" type="checkbox" /> Auto-Ausgaben ab „Preis gilt ab“ anpassen</label>
        </div>
        <p className="muted">Die App legt bei einer Preisänderung automatisch eine neue Preisphase an. Bereits erzeugte Auto-Ausgaben bleiben unverändert, solange die Option nicht aktiv ist.</p>
      </fieldset>

      <fieldset className="fieldset modal-form-section full-span task-create-options-page contract-term-page" id="edit-contract-term" hidden={panel !== "term"}>
        <legend>Laufzeit & Kündigung</legend>
        <div className="form-grid">
          <label>Ende/Laufzeit bis<input name="endDate" type="date" defaultValue={toDateInputValue(contract.endDate)} /></label>
          <label>Kündigung spätestens am<input name="cancellationDeadline" type="date" defaultValue={toAnnualCancellationInputValue(contract.cancellationDeadlineMonth, contract.cancellationDeadlineDay)} /></label>
          <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" defaultValue={contract.cancellationNoticeDays ?? ""} /></label>
          <label className="checkbox-field"><input name="autoRenewal" type="checkbox" defaultChecked={contract.autoRenewal} /> Verlängert sich automatisch</label>
          <label>Verlängerungsrhythmus<select name="renewalInterval" defaultValue={contract.renewalInterval === "QUARTERLY" || contract.renewalInterval === "YEARLY" ? contract.renewalInterval : "MONTHLY"}><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
        </div>
        <p className="muted">Bei automatischer Verlängerung ist &quot;Ende/Laufzeit bis&quot; der nächste Vertrags- oder Verlängerungstermin. Die App rollt die Kündigungsfrist danach automatisch weiter.</p>
      </fieldset>

      <fieldset className="fieldset modal-form-section full-span task-create-options-page finance-document-page contract-document-page" id="edit-contract-document" hidden={panel !== "document"}>
        <legend>Beleg / Dokument</legend>
        <div className="form-grid">
          {primaryDocument ? <input type="hidden" name="documentId" value={primaryDocument.id} /> : null}
          {primaryDocument && !primaryDocument.url ? <p className="muted full-span">Verknüpfte NAS-Datei: {primaryDocument.title}. Weitere Belege können hinzugefügt werden.</p> : null}
          <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.url ? primaryDocument.title : ""} placeholder="Vertrag, Rechnung, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </fieldset>
      {panel === "auto" ? <div className="contract-auto-line-art" aria-hidden="true" /> : null}
      {panel === "document" ? <div className="document-line-art" aria-hidden="true" /> : null}
      <div className="modal-submit-row modal-footer">
        {panel === "main" ? <button className="button full-span" type="submit">Vertrag speichern</button> : <button className="button full-span" type="button" onClick={() => setPanel("main")}>Übernehmen</button>}
      </div>
    </form>
  );
}

function formatEuroInput(amountCents: number) {
  return (amountCents / 100).toFixed(2).replace(".", ",");
}
