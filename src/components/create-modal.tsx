"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, ClipboardCheck, Euro, FileText, Fuel, Plus, ScrollText } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContract,
  createDocumentReference,
  createLocalDocumentReference,
  createExpense,
  createFuelEntry,
  createRecurringTask,
  createTask
} from "@/lib/actions";
import { enqueueOfflineExpenseCreate, enqueueOfflineTaskCreate } from "@/lib/offline-sync";
import { DocumentFilePicker } from "@/components/document-file-picker";
import { SearchableSelect } from "@/components/searchable-select";
import { BottomSheet, FloatingActionButton, IconButton } from "@/components/ui-system";

type CreateModalProps = {
  categories: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  contracts: { id: string; provider: string; contractType: string; status: string }[];
  members: { id: string; userId: string; user: { name: string } }[];
  cars: { id: string; name: string; licensePlate: string }[];
  documentRoots: { id: string; name: string }[];
  fuelExpenseSettings: {
    autoCreateExpense: boolean;
    defaultCategoryId: string | null;
    defaultLabelId: string | null;
    defaultPaymentMethod: string;
    defaultStore: string;
    defaultDescription: string;
  } | null;
};

type CreateType = "expense" | "fuel" | "task" | "contract" | "document";

const createTypes = [
  { id: "expense", label: "Ausgabe", detail: "Geld ausgegeben oder erhalten", icon: Euro, tone: "rose" },
  { id: "fuel", label: "Tankstopp", detail: "Kilometerstand, Kosten und Verbrauch", icon: Fuel, tone: "mint" },
  { id: "task", label: "Aufgabe", detail: "To-do mit Priorität und Deadline", icon: ClipboardCheck, tone: "blue" },
  { id: "contract", label: "Vertrag", detail: "Abo, Versicherung oder Frist", icon: ScrollText, tone: "amber" },
  { id: "document", label: "Dokument", detail: "Link oder NAS-Datei speichern", icon: FileText, tone: "violet" }
] satisfies { id: CreateType; label: string; detail: string; icon: typeof Euro; tone: string }[];

const typeByPath: Record<string, CreateType> = {
  "/ausgaben": "expense",
  "/kilometer": "fuel",
  "/aufgaben": "task",
  "/vertraege": "contract",
  "/dokumente": "document"
};

export function CreateModal({ categories, labels, contracts, members, cars, documentRoots, fuelExpenseSettings }: CreateModalProps) {
  const pathname = usePathname();
  const pageType = typeByPath[pathname];
  const shouldShow = pathname === "/dashboard" || Boolean(pageType);
  const allowedTypes = pathname === "/dashboard" ? createTypes : createTypes.filter((item) => item.id === pageType);
  const defaultType = allowedTypes[0]?.id ?? "expense";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CreateType>(defaultType);
  const [formStarted, setFormStarted] = useState(allowedTypes.length <= 1);
  const [returnTo, setReturnTo] = useState(pathname);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const selectedType = allowedTypes.some((item) => item.id === type) ? type : defaultType;
  function openCreateModal() {
    setType(defaultType);
    setFormStarted(allowedTypes.length <= 1);
    setReturnTo(`${window.location.pathname}${window.location.search}`);
    setOpen(true);
  }

  if (!shouldShow) return null;

  return (
    <>
      <FloatingActionButton
        type="button"
        aria-label="Neu erstellen"
        title="Neu erstellen"
        onClick={openCreateModal}
      >
        <Plus aria-hidden="true" size={28} strokeWidth={2.4} />
      </FloatingActionButton>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={formStarted ? createTypes.find((item) => item.id === selectedType)?.label ?? "Neu erstellen" : "Neuen Eintrag erstellen"}
        description={!formStarted ? "Was möchtest du erfassen?" : undefined}
        leadingAction={allowedTypes.length > 1 && formStarted ? (
          <IconButton className="modal-back-button" type="button" label="Zur Auswahl" onClick={() => setFormStarted(false)}>
            <ArrowLeft size={19} aria-hidden="true" />
          </IconButton>
        ) : null}
        wide={formStarted}
        labelledById="create-modal-title"
      >
              <div className="create-dialog-body">
                {allowedTypes.length > 1 && !formStarted ? (
                  <div className="create-type-grid">
                    {allowedTypes.map((item) => (
                      <button
                        className={`create-type create-type-${item.tone}`}
                        type="button"
                        onClick={() => { setType(item.id); setFormStarted(true); }}
                        key={item.id}
                      >
                        <span className="create-type-icon" aria-hidden="true"><item.icon size={18} /></span>
                        <span className="create-type-copy">
                          <strong>{item.label}</strong>
                          <span>{item.detail}</span>
                        </span>
                        <ChevronRight className="create-type-chevron" size={18} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {formStarted && selectedType === "expense" ? <ExpenseForm categories={categories} labels={labels} contracts={contracts} documentRoots={documentRoots} today={today} returnTo={returnTo} onSubmit={() => setOpen(false)} /> : null}
                {formStarted && selectedType === "fuel" ? (
                  <FuelForm
                    cars={cars}
                    categories={categories}
                    labels={labels}
                    documentRoots={documentRoots}
                    settings={fuelExpenseSettings}
                    today={today}
                    returnTo={returnTo}
                    onSubmit={() => setOpen(false)}
                  />
                ) : null}
                {formStarted && selectedType === "task" ? <TaskForm members={members} documentRoots={documentRoots} today={today} onSubmit={() => setOpen(false)} /> : null}
                {formStarted && selectedType === "contract" ? <ContractForm categories={categories} labels={labels} documentRoots={documentRoots} today={today} onSubmit={() => setOpen(false)} /> : null}
                {formStarted && selectedType === "document" ? <DocumentForm documentRoots={documentRoots} onSubmit={() => setOpen(false)} /> : null}
              </div>
      </BottomSheet>
    </>
  );
}

function ExpenseForm({
  categories,
  labels,
  contracts,
  documentRoots,
  today,
  returnTo,
  onSubmit
}: {
  categories: CreateModalProps["categories"];
  labels: CreateModalProps["labels"];
  contracts: CreateModalProps["contracts"];
  documentRoots: CreateModalProps["documentRoots"];
  today: string;
  returnTo: string;
  onSubmit: () => void;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (navigator.onLine) {
      onSubmit();
      return;
    }
    event.preventDefault();
    const saved = await enqueueOfflineExpenseCreate(new FormData(event.currentTarget));
    if (saved) onSubmit();
    else window.alert("Offline-Speichern ist noch nicht vorbereitet. Öffne die App einmal online, damit sie die lokalen Daten initial speichern kann.");
  }

  return (
    <form action={createExpense} className="form form-grid modal-form" onSubmit={handleSubmit}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <nav className="modal-section-tabs full-span" aria-label="Formularbereiche">
        <a href="#create-expense-core">Details</a>
        <a href="#create-expense-assignment">Zuordnung</a>
        <a href="#create-expense-document">Dokument</a>
      </nav>
      <fieldset className="fieldset modal-form-section full-span" id="create-expense-core">
        <legend>Kernangaben</legend>
        <div className="form-grid">
          <label>Art<select name="kind" defaultValue="EXPENSE"><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
          <label>Betrag in EUR<input name="amount" inputMode="decimal" placeholder="42,50" required /></label>
          <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span">
        <legend>Details</legend>
        <div className="form-grid">
          <label>Beschreibung<input name="description" placeholder="Wocheneinkauf, Dienstreise, Rückerstattung ..." /></label>
          <label>Bezahlart<input name="paymentMethod" list="payment-methods" placeholder="Karte, Bar, Überweisung ..." /></label>
          <label>Laden<input name="store" placeholder="Rewe, Lidl, Amazon ..." /></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-expense-assignment">
        <legend>Zuordnung</legend>
        <div className="form-grid">
          <SearchableSelect name="categoryId" label="Kategorie" options={categories} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
          <SearchableSelect name="labelId" label="Label / Projekt" options={labels} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
          <label>Vertrag<select name="contractId" defaultValue=""><option value="">Kein Vertrag</option>{contracts.filter((contract) => contract.status === "ACTIVE").map((contract) => <option value={contract.id} key={contract.id}>{contract.provider} · {contract.contractType}</option>)}</select></label>
        </div>
      </fieldset>
      <PaymentMethods />
      <details className="optional-section full-span" id="create-expense-document">
        <summary>Beleg / Dokument verknüpfen</summary>
        <div className="form-grid">
          <label>Dokumenttitel<input name="documentTitle" placeholder="Rechnung, Beleg, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </details>
      <div className="modal-submit-row modal-footer">
        <button className="button full-span" type="submit">Speichern</button>
      </div>
    </form>
  );
}

function FuelForm({
  cars,
  categories,
  labels,
  documentRoots,
  settings,
  today,
  returnTo,
  onSubmit
}: {
  cars: CreateModalProps["cars"];
  categories: CreateModalProps["categories"];
  labels: CreateModalProps["labels"];
  documentRoots: CreateModalProps["documentRoots"];
  settings: CreateModalProps["fuelExpenseSettings"];
  today: string;
  returnTo: string;
  onSubmit: () => void;
}) {
  const [bookExpense, setBookExpense] = useState(Boolean(settings?.autoCreateExpense));
  if (cars.length === 0) {
    return <div className="empty">Noch kein aktives Auto vorhanden. Admins können Autos im Kilometer-Setup anlegen.</div>;
  }

  return (
    <form action={createFuelEntry} className="form form-grid modal-form" onSubmit={onSubmit}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <nav className="modal-section-tabs full-span" aria-label="Formularbereiche">
        <a href="#create-fuel-stop">Tankstopp</a>
        <a href="#create-fuel-cost">Kosten</a>
        <a href="#create-fuel-expense">Ausgabe</a>
      </nav>
      <fieldset className="fieldset modal-form-section full-span" id="create-fuel-stop">
        <legend>Tankstopp</legend>
        <div className="form-grid">
          <label>
            Auto
            <select name="carId" defaultValue={cars[0]?.id ?? ""} required>
              {cars.map((car) => <option value={car.id} key={car.id}>{car.name}{car.licensePlate ? ` · ${car.licensePlate}` : ""}</option>)}
            </select>
          </label>
          <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
          <label>Kilometerstand<input name="odometerKm" type="number" inputMode="numeric" min="0" required /></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-fuel-cost">
        <legend>Verbrauch & Kosten</legend>
        <div className="form-grid">
          <label>Liter<input name="liters" inputMode="decimal" placeholder="45,34" required /></label>
          <label>Betrag in EUR<input name="cost" inputMode="decimal" placeholder="71,01" required /></label>
          <label>Bemerkung<input name="note" placeholder="Urlaub, bezahlt von ..., Werkstatt ..." /></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-fuel-expense">
        <legend>Ausgabe</legend>
        <label className="checkbox-field full-span">
          <input name="createExpenseFromFuel" type="checkbox" checked={bookExpense} onChange={(event) => setBookExpense(event.currentTarget.checked)} />
          Als Ausgabe buchen
        </label>
      </fieldset>
      {bookExpense ? (
        <fieldset className="fieldset modal-form-section full-span">
          <legend>Ausgaben-Details</legend>
          <div className="form-grid">
            <SearchableSelect name="expenseCategoryId" label="Kategorie" options={categories} defaultValue={settings?.defaultCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
            <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} defaultValue={settings?.defaultLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
            <label>Bezahlart<input name="expensePaymentMethod" list="payment-methods" defaultValue={settings?.defaultPaymentMethod ?? ""} placeholder="Karte, Bar, Überweisung ..." /></label>
            <label>Laden<input name="expenseStore" defaultValue={settings?.defaultStore ?? ""} placeholder="Tankstelle oder Händler" /></label>
            <label className="full-span">Beschreibung<input name="expenseDescription" defaultValue={settings?.defaultDescription ?? ""} /></label>
          </div>
          <details className="optional-section full-span">
            <summary>Beleg / Dokument verknüpfen</summary>
            <div className="form-grid">
              <label>Dokumenttitel<input name="documentTitle" placeholder="Rechnung, Beleg, Nachweis ..." /></label>
              <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
              <DocumentFilePicker roots={documentRoots} />
            </div>
          </details>
          <PaymentMethods />
        </fieldset>
      ) : null}
      <div className="modal-submit-row modal-footer">
        <button className="button full-span" type="submit">Speichern</button>
      </div>
    </form>
  );
}

function TaskForm({
  members,
  documentRoots,
  today,
  onSubmit
}: {
  members: CreateModalProps["members"];
  documentRoots: CreateModalProps["documentRoots"];
  today: string;
  onSubmit: () => void;
}) {
  const [recurrencePreset, setRecurrencePreset] = useState("NONE");
  const [customIntervalUnit, setCustomIntervalUnit] = useState("DAY");
  const isRecurring = recurrencePreset !== "NONE";
  const customIntervalMax = customIntervalUnit === "WEEK" ? 52 : 365;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isRecurring && !navigator.onLine) {
      event.preventDefault();
      window.alert("Wiederholte Aufgaben können nur online erstellt werden.");
      return;
    }
    if (navigator.onLine) {
      onSubmit();
      return;
    }
    event.preventDefault();
    const saved = await enqueueOfflineTaskCreate(new FormData(event.currentTarget));
    if (saved) onSubmit();
    else window.alert("Offline-Speichern ist noch nicht vorbereitet. Öffne die App einmal online, damit sie die lokalen Daten initial speichern kann.");
  }

  return (
    <form action={isRecurring ? createRecurringTask : createTask} className="form form-grid modal-form" onSubmit={handleSubmit}>
      <nav className="modal-section-tabs full-span" aria-label="Formularbereiche">
        <a href="#create-task-core">Aufgabe</a>
        <a href="#create-task-plan">Planung</a>
        <a href="#create-task-repeat">Rhythmus</a>
        <a href="#create-task-details">Details</a>
      </nav>
      <fieldset className="fieldset modal-form-section full-span" id="create-task-core">
        <legend>Aufgabe</legend>
        <div className="form-grid">
          <label>Titel<input name="title" required /></label>
          <label>Zuweisen an<select name="assignedToUserId" defaultValue=""><option value="">Nicht zugewiesen</option>{members.map((member) => <option value={member.userId} key={member.id}>{member.user.name}</option>)}</select></label>
          <label>Priorität<select name="priority" defaultValue="MEDIUM"><option value="LOW">Niedrig</option><option value="MEDIUM">Mittel</option><option value="HIGH">Hoch</option><option value="URGENT">Dringend</option></select></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-task-plan">
        <legend>Planung</legend>
        <div className="form-grid">
          <label>{isRecurring ? "Startdatum" : "Deadline"}<input key={isRecurring ? "recurring-date" : "single-date"} name="dueDate" type="date" defaultValue={isRecurring ? today : ""} required={isRecurring} /></label>
          <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-task-repeat">
        <legend>Wiederholen</legend>
        <div className="form-grid">
          <label>
            Rhythmus
            <select name="recurrencePreset" value={recurrencePreset} onChange={(event) => setRecurrencePreset(event.currentTarget.value)}>
              <option value="NONE">Einmalig</option>
              <option value="DAILY">Täglich</option>
              <option value="EVERY_2_DAYS">Alle 2 Tage</option>
              <option value="WEEKLY">Wöchentlich</option>
              <option value="EVERY_2_WEEKS">Alle 2 Wochen</option>
              <option value="MONTHLY">Monatlich</option>
              <option value="QUARTERLY">Vierteljährlich</option>
              <option value="SEMIANNUAL">Halbjährlich</option>
              <option value="YEARLY">Jährlich</option>
              <option value="CUSTOM">Individuell</option>
            </select>
          </label>
          {recurrencePreset === "CUSTOM" ? (
            <>
              <label>Alle<input name="intervalCount" type="number" min="1" max={customIntervalMax} defaultValue="1" required /></label>
              <label>
                Einheit
                <select name="intervalUnit" value={customIntervalUnit} onChange={(event) => setCustomIntervalUnit(event.currentTarget.value)}>
                  <option value="DAY">Tage</option>
                  <option value="WEEK">Wochen</option>
                  <option value="MONTH">Monate</option>
                  <option value="YEAR">Jahre</option>
                </select>
              </label>
            </>
          ) : null}
          {isRecurring ? <label>Enddatum optional<input name="endDate" type="date" /></label> : null}
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-task-details">
        <legend>Details</legend>
        <label>Beschreibung<textarea name="description" /></label>
      </fieldset>
      <details className="optional-section full-span">
        <summary>Dokument verknüpfen</summary>
        <div className="form-grid">
          <label>Dokumenttitel<input name="documentTitle" placeholder="Anleitung, Foto, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </details>
      <div className="modal-submit-row modal-footer">
        <button className="button full-span" type="submit">Speichern</button>
      </div>
    </form>
  );
}

function ContractForm({
  categories,
  labels,
  documentRoots,
  today,
  onSubmit
}: {
  categories: CreateModalProps["categories"];
  labels: CreateModalProps["labels"];
  documentRoots: CreateModalProps["documentRoots"];
  today: string;
  onSubmit: () => void;
}) {
  return (
    <form action={createContract} className="form form-grid modal-form" onSubmit={onSubmit}>
      <input type="hidden" name="priceValidFrom" value={today} />
      <input type="hidden" name="priceChangeMode" value="NEW_PHASE" />
      <nav className="modal-section-tabs full-span" aria-label="Formularbereiche">
        <a href="#create-contract-core">Vertrag</a>
        <a href="#create-contract-cost">Kosten</a>
        <a href="#create-contract-auto">Automatik</a>
        <a href="#create-contract-term">Laufzeit</a>
        <a href="#create-contract-document">Dokument</a>
      </nav>
      <fieldset className="fieldset modal-form-section full-span" id="create-contract-core">
        <legend>Vertrag</legend>
        <div className="form-grid">
          <label>Anbieter<input name="provider" required /></label>
          <label>Vertragsart<input name="contractType" placeholder="Mobilfunk, Versicherung, Abo ..." required /></label>
          <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
          <label>Status<select name="status" defaultValue="ACTIVE"><option value="ACTIVE">Aktiv</option><option value="DRAFT">Entwurf</option><option value="CANCELLED">Gekündigt</option><option value="EXPIRED">Ausgelaufen</option></select></label>
          <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-contract-cost">
        <legend>Kosten & Abbuchung</legend>
        <div className="form-grid">
          <label>Kosten in EUR<input name="cost" inputMode="decimal" placeholder="29,99" required /></label>
          <label>
            Zahlungsrhythmus
            <select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="YEARLY">Jährlich</option><option value="QUARTERLY">Quartalsweise</option><option value="ONCE">Einmalig</option><option value="OTHER">Sonstiges</option></select>
          </label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-contract-auto">
        <legend>Automatische Ausgabe</legend>
        <div className="form-grid">
          <label className="checkbox-field full-span"><input name="autoCreateExpenses" type="checkbox" /> Automatisch als Ausgabe eintragen</label>
          <label>Einzugstag<input name="expensePaymentDay" type="number" min="1" max="31" defaultValue={new Date(`${today}T00:00:00`).getDate()} /></label>
          <SearchableSelect name="expenseCategoryId" label="Ausgaben-Kategorie" options={categories} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
          <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-contract-term">
        <legend>Laufzeit & Kündigung</legend>
        <div className="form-grid">
          <label>Ende/Laufzeit bis<input name="endDate" type="date" /></label>
          <label>Kündigung spätestens am<input name="cancellationDeadline" type="date" /></label>
          <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" /></label>
          <label className="checkbox-field"><input name="autoRenewal" type="checkbox" /> Verlängert sich automatisch</label>
          <label>
            Verlängerungsrhythmus
            <select name="renewalInterval" defaultValue="MONTHLY">
              <option value="MONTHLY">Monatlich</option>
              <option value="QUARTERLY">Quartalsweise</option>
              <option value="YEARLY">Jährlich</option>
            </select>
          </label>
        </div>
        <p className="muted">Bei automatischer Verlängerung ist &quot;Ende/Laufzeit bis&quot; der nächste Vertrags- oder Verlängerungstermin. Die App rollt die Kündigungsfrist danach automatisch weiter.</p>
      </fieldset>
      <label className="full-span">Notizen<textarea name="description" /></label>
      <details className="optional-section full-span" id="create-contract-document">
        <summary>Beleg / Dokument verknüpfen</summary>
        <div className="form-grid">
          <label>Dokumenttitel<input name="documentTitle" placeholder="Vertrag, Rechnung, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </details>
      <div className="modal-submit-row modal-footer">
        <button className="button full-span" type="submit">Speichern</button>
      </div>
    </form>
  );
}

function DocumentForm({ documentRoots, onSubmit }: { documentRoots: CreateModalProps["documentRoots"]; onSubmit: () => void }) {
  const [source, setSource] = useState<"link" | "file">("link");
  const linkSelected = source === "link";

  return (
    <div className="form form-grid modal-form">
      <section className="fieldset modal-form-section full-span">
        <h3>Quelle</h3>
        <div className="document-source-choice" role="group" aria-label="Dokumentquelle wählen">
          <button className={linkSelected ? "document-source-card active" : "document-source-card"} type="button" onClick={() => setSource("link")}>
            HTTPS-Link speichern
            <span>Für Drive, Synology-HTTPS, WebDAV oder andere sichere Links.</span>
          </button>
          <button className={!linkSelected ? "document-source-card active" : "document-source-card"} type="button" onClick={() => setSource("file")}>
            Datei aus NAS auswählen
            <span>Öffnet den read-only Explorer für konfigurierte Dokumentordner.</span>
          </button>
        </div>
      </section>
      {!linkSelected ? (
        <form action={createLocalDocumentReference} className="form form-grid modal-form full-span" onSubmit={onSubmit}>
          <fieldset className="fieldset modal-form-section full-span">
            <legend>Datei</legend>
            <DocumentFilePicker roots={documentRoots} />
            {documentRoots.length === 0 ? (
              <p className="muted">Ein Admin muss zuerst in den Einstellungen einen Dokumentbereich freigeben.</p>
            ) : null}
          </fieldset>
          <fieldset className="fieldset modal-form-section full-span">
            <legend>Zuordnung</legend>
            <div className="form-grid">
              <label>Titel optional<input name="title" placeholder="Leer lassen, um den Dateinamen zu verwenden" /></label>
              <label>Bezug<select name="linkedEntityType" defaultValue="GENERAL"><option value="GENERAL">Allgemein</option><option value="EXPENSE">Ausgabe</option><option value="TASK">Aufgabe</option><option value="CONTRACT">Vertrag</option></select></label>
              <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
              <label className="document-advanced-link-id">Bezugs-ID optional<input name="linkedEntityId" /></label>
            </div>
          </fieldset>
          <fieldset className="fieldset modal-form-section full-span">
            <legend>Details</legend>
            <label>Beschreibung<textarea name="description" /></label>
          </fieldset>
          <div className="modal-submit-row modal-footer">
            <button className="button full-span" type="submit" disabled={documentRoots.length === 0}>Speichern</button>
          </div>
        </form>
      ) : null}
      {linkSelected ? (
        <form action={createDocumentReference} className="form form-grid modal-form full-span" onSubmit={onSubmit}>
          <fieldset className="fieldset modal-form-section full-span">
            <legend>Dokument</legend>
            <div className="form-grid">
              <input type="hidden" name="referenceType" value="EXTERNAL_URL" />
              <label>Titel<input name="title" required /></label>
              <label>HTTPS-Link<input name="url" type="url" placeholder="https://drive.google.com/..." required /></label>
            </div>
          </fieldset>
          <fieldset className="fieldset modal-form-section full-span">
            <legend>Zuordnung</legend>
            <div className="form-grid">
              <label>Bezug<select name="linkedEntityType" defaultValue="GENERAL"><option value="GENERAL">Allgemein</option><option value="EXPENSE">Ausgabe</option><option value="TASK">Aufgabe</option><option value="CONTRACT">Vertrag</option></select></label>
              <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
              <label className="document-advanced-link-id">Bezugs-ID optional<input name="linkedEntityId" /></label>
            </div>
          </fieldset>
          <fieldset className="fieldset modal-form-section full-span">
            <legend>Details</legend>
            <label>Beschreibung<textarea name="description" /></label>
          </fieldset>
          <div className="modal-submit-row modal-footer">
            <button className="button full-span" type="submit">Speichern</button>
          </div>
        </form>
      ) : null}
    </div>
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
