"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { ClipboardCheck, Euro, FileText, Fuel, Plus, ScrollText, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContract,
  createDocumentReference,
  createExpense,
  createFuelEntry,
  createRecurringTask,
  createTask
} from "@/lib/actions";
import { enqueueOfflineExpenseCreate, enqueueOfflineTaskCreate } from "@/lib/offline-sync";
import { ModalPortal } from "@/components/modal-portal";
import { SearchableSelect } from "@/components/searchable-select";

type CreateModalProps = {
  categories: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  contracts: { id: string; provider: string; contractType: string; status: string }[];
  members: { id: string; userId: string; user: { name: string } }[];
  cars: { id: string; name: string; licensePlate: string }[];
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
  { id: "expense", label: "Ausgabe", detail: "Ausgabe oder Einnahme erfassen", icon: Euro },
  { id: "fuel", label: "Tankstopp", detail: "Kilometerstand und Verbrauch erfassen", icon: Fuel },
  { id: "task", label: "Aufgabe", detail: "To-do mit Priorität und Deadline", icon: ClipboardCheck },
  { id: "contract", label: "Vertrag", detail: "Abo, Versicherung oder Frist", icon: ScrollText },
  { id: "document", label: "Dokument", detail: "HTTPS-Verweis speichern", icon: FileText }
] satisfies { id: CreateType; label: string; detail: string; icon: typeof Euro }[];

const typeByPath: Record<string, CreateType> = {
  "/ausgaben": "expense",
  "/kilometer": "fuel",
  "/aufgaben": "task",
  "/vertraege": "contract",
  "/dokumente": "document"
};

export function CreateModal({ categories, labels, contracts, members, cars, fuelExpenseSettings }: CreateModalProps) {
  const pathname = usePathname();
  const pageType = typeByPath[pathname];
  const shouldShow = pathname === "/dashboard" || Boolean(pageType);
  const allowedTypes = pathname === "/dashboard" ? createTypes : createTypes.filter((item) => item.id === pageType);
  const defaultType = allowedTypes[0]?.id ?? "expense";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CreateType>(defaultType);
  const [returnTo, setReturnTo] = useState(pathname);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const selectedType = allowedTypes.some((item) => item.id === type) ? type : defaultType;
  function openCreateModal() {
    setType(defaultType);
    setReturnTo(`${window.location.pathname}${window.location.search}`);
    setOpen(true);
  }

  if (!shouldShow) return null;

  return (
    <>
      <button
        className="fab-button"
        type="button"
        aria-label="Neu erstellen"
        title="Neu erstellen"
        onClick={openCreateModal}
      >
        <Plus aria-hidden="true" size={28} strokeWidth={2.4} />
      </button>
      {open ? (
        <ModalPortal>
          <div className="modal-backdrop" role="presentation">
            <section className="modal-panel create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
              <div className="modal-head">
                <div>
                  <span className="eyebrow">Neu erstellen</span>
                  <h2 id="create-modal-title">{createTypes.find((item) => item.id === selectedType)?.label}</h2>
                </div>
                <button className="icon-button" type="button" aria-label="Schließen" title="Schließen" onClick={() => setOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              {allowedTypes.length > 1 ? (
                <div className="create-type-grid">
                  {allowedTypes.map((item) => (
                    <button
                      className={selectedType === item.id ? "create-type active" : "create-type"}
                      type="button"
                      onClick={() => setType(item.id)}
                      key={item.id}
                    >
                      <strong><item.icon size={17} />{item.label}</strong>
                      <span>{item.detail}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedType === "expense" ? <ExpenseForm categories={categories} labels={labels} contracts={contracts} today={today} returnTo={returnTo} onSubmit={() => setOpen(false)} /> : null}
              {selectedType === "fuel" ? (
                <FuelForm
                  cars={cars}
                  categories={categories}
                  labels={labels}
                  settings={fuelExpenseSettings}
                  today={today}
                  returnTo={returnTo}
                  onSubmit={() => setOpen(false)}
                />
              ) : null}
              {selectedType === "task" ? <TaskForm members={members} today={today} onSubmit={() => setOpen(false)} /> : null}
              {selectedType === "contract" ? <ContractForm categories={categories} labels={labels} today={today} onSubmit={() => setOpen(false)} /> : null}
              {selectedType === "document" ? <DocumentForm onSubmit={() => setOpen(false)} /> : null}
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}

function ExpenseForm({
  categories,
  labels,
  contracts,
  today,
  returnTo,
  onSubmit
}: {
  categories: CreateModalProps["categories"];
  labels: CreateModalProps["labels"];
  contracts: CreateModalProps["contracts"];
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
      <label>Art<select name="kind" defaultValue="EXPENSE"><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
      <label>Betrag in EUR<input name="amount" inputMode="decimal" placeholder="42,50" required /></label>
      <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
      <label>Beschreibung<input name="description" placeholder="Wocheneinkauf, Dienstreise, Rückerstattung ..." /></label>
      <label>Bezahlart<input name="paymentMethod" list="payment-methods" placeholder="Karte, Bar, Überweisung ..." /></label>
      <label>Laden<input name="store" placeholder="Rewe, Lidl, Amazon ..." /></label>
      <SearchableSelect name="categoryId" label="Kategorie" options={categories} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
      <SearchableSelect name="labelId" label="Label / Projekt" options={labels} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
      <label>Vertrag<select name="contractId" defaultValue=""><option value="">Kein Vertrag</option>{contracts.filter((contract) => contract.status === "ACTIVE").map((contract) => <option value={contract.id} key={contract.id}>{contract.provider} · {contract.contractType}</option>)}</select></label>
      <PaymentMethods />
      <fieldset className="fieldset full-span">
        <legend>Drive-Link optional verknüpfen</legend>
        <label>Dokumenttitel<input name="documentTitle" placeholder="Rechnung, Beleg, Nachweis ..." /></label>
        <label>Drive-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
      </fieldset>
      <button className="button full-span" type="submit">Speichern</button>
    </form>
  );
}

function FuelForm({
  cars,
  categories,
  labels,
  settings,
  today,
  returnTo,
  onSubmit
}: {
  cars: CreateModalProps["cars"];
  categories: CreateModalProps["categories"];
  labels: CreateModalProps["labels"];
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
      <label>
        Auto
        <select name="carId" defaultValue={cars[0]?.id ?? ""} required>
          {cars.map((car) => <option value={car.id} key={car.id}>{car.name}{car.licensePlate ? ` · ${car.licensePlate}` : ""}</option>)}
        </select>
      </label>
      <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
      <label>Kilometerstand<input name="odometerKm" type="number" inputMode="numeric" min="0" required /></label>
      <label>Liter<input name="liters" inputMode="decimal" placeholder="45,34" required /></label>
      <label>Betrag in EUR<input name="cost" inputMode="decimal" placeholder="71,01" required /></label>
      <label className="full-span">Bemerkung<input name="note" placeholder="Urlaub, bezahlt von ..., Werkstatt ..." /></label>
      <label className="checkbox-field full-span">
        <input name="createExpenseFromFuel" type="checkbox" checked={bookExpense} onChange={(event) => setBookExpense(event.currentTarget.checked)} />
        Als Ausgabe buchen
      </label>
      {bookExpense ? (
        <fieldset className="fieldset full-span">
          <legend>Ausgabe</legend>
          <SearchableSelect name="expenseCategoryId" label="Kategorie" options={categories} defaultValue={settings?.defaultCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
          <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} defaultValue={settings?.defaultLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
          <label>Bezahlart<input name="expensePaymentMethod" list="payment-methods" defaultValue={settings?.defaultPaymentMethod ?? ""} placeholder="Karte, Bar, Überweisung ..." /></label>
          <label>Laden<input name="expenseStore" defaultValue={settings?.defaultStore ?? ""} placeholder="Tankstelle oder Händler" /></label>
          <label className="full-span">Beschreibung<input name="expenseDescription" defaultValue={settings?.defaultDescription ?? ""} /></label>
          <fieldset className="fieldset full-span">
            <legend>Drive-Link optional verknüpfen</legend>
            <label>Dokumenttitel<input name="documentTitle" placeholder="Rechnung, Beleg, Nachweis ..." /></label>
            <label>Drive-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
          </fieldset>
          <PaymentMethods />
        </fieldset>
      ) : null}
      <button className="button full-span" type="submit">Speichern</button>
    </form>
  );
}

function TaskForm({ members, today, onSubmit }: { members: CreateModalProps["members"]; today: string; onSubmit: () => void }) {
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
      <label>Titel<input name="title" required /></label>
      <label>Zuweisen an<select name="assignedToUserId" defaultValue=""><option value="">Nicht zugewiesen</option>{members.map((member) => <option value={member.userId} key={member.id}>{member.user.name}</option>)}</select></label>
      <label>{isRecurring ? "Startdatum" : "Deadline"}<input key={isRecurring ? "recurring-date" : "single-date"} name="dueDate" type="date" defaultValue={isRecurring ? today : ""} required={isRecurring} /></label>
      <label>Priorität<select name="priority" defaultValue="MEDIUM"><option value="LOW">Niedrig</option><option value="MEDIUM">Mittel</option><option value="HIGH">Hoch</option><option value="URGENT">Dringend</option></select></label>
      <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
      <fieldset className="fieldset full-span">
        <legend>Wiederholen</legend>
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
      </fieldset>
      <label className="full-span">Beschreibung<textarea name="description" /></label>
      <button className="button full-span" type="submit">Speichern</button>
    </form>
  );
}

function ContractForm({
  categories,
  labels,
  today,
  onSubmit
}: {
  categories: CreateModalProps["categories"];
  labels: CreateModalProps["labels"];
  today: string;
  onSubmit: () => void;
}) {
  return (
    <form action={createContract} className="form form-grid modal-form" onSubmit={onSubmit}>
      <label>Anbieter<input name="provider" required /></label>
      <label>Vertragsart<input name="contractType" placeholder="Mobilfunk, Versicherung, Abo ..." required /></label>
      <label>Kosten in EUR<input name="cost" inputMode="decimal" placeholder="29,99" required /></label>
      <input type="hidden" name="priceValidFrom" value={today} />
      <input type="hidden" name="priceChangeMode" value="NEW_PHASE" />
      <label>Intervall<select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="YEARLY">Jährlich</option><option value="QUARTERLY">Quartalsweise</option><option value="ONCE">Einmalig</option><option value="OTHER">Sonstiges</option></select></label>
      <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
      <fieldset className="fieldset full-span">
        <legend>Automatische Ausgabe</legend>
        <label className="checkbox-field"><input name="autoCreateExpenses" type="checkbox" /> Automatisch als Ausgabe eintragen</label>
        <label>Einzugstag<input name="expensePaymentDay" type="number" min="1" max="31" defaultValue={new Date(`${today}T00:00:00`).getDate()} /></label>
        <SearchableSelect name="expenseCategoryId" label="Ausgaben-Kategorie" options={categories} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
        <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
      </fieldset>
      <label>Ende/Laufzeit bis<input name="endDate" type="date" /></label>
      <label>Kündigung spätestens am<input name="cancellationDeadline" type="date" /></label>
      <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" /></label>
      <label className="checkbox-field"><input name="autoRenewal" type="checkbox" /> Verlängert sich automatisch</label>
      <label>
        Verlängerung
        <select name="renewalInterval" defaultValue="MONTHLY">
          <option value="MONTHLY">Monatlich</option>
          <option value="QUARTERLY">Quartalsweise</option>
          <option value="YEARLY">Jährlich</option>
        </select>
      </label>
      <p className="muted full-span">Bei automatisch verlängerten Verträgen ist „Ende/Laufzeit bis“ der nächste Vertrags- oder Verlängerungstermin. Die App rollt die Kündigungsfrist danach automatisch weiter.</p>
      <label>Status<select name="status" defaultValue="ACTIVE"><option value="ACTIVE">Aktiv</option><option value="DRAFT">Entwurf</option><option value="CANCELLED">Gekündigt</option><option value="EXPIRED">Ausgelaufen</option></select></label>
      <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
      <label className="full-span">Notizen<textarea name="description" /></label>
      <fieldset className="fieldset full-span">
        <legend>Drive-Link optional verknüpfen</legend>
        <label>Dokumenttitel<input name="documentTitle" placeholder="Vertrag, Rechnung, Nachweis ..." /></label>
        <label>Drive-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
      </fieldset>
      <button className="button full-span" type="submit">Speichern</button>
    </form>
  );
}

function DocumentForm({ onSubmit }: { onSubmit: () => void }) {
  return (
    <form action={createDocumentReference} className="form form-grid modal-form" onSubmit={onSubmit}>
      <label>Titel<input name="title" required /></label>
      <label>Drive-Link<input name="url" type="url" placeholder="https://drive.google.com/..." required /></label>
      <label>Bezug<select name="linkedEntityType" defaultValue="GENERAL"><option value="GENERAL">Allgemein</option><option value="EXPENSE">Ausgabe</option><option value="TASK">Aufgabe</option><option value="CONTRACT">Vertrag</option></select></label>
      <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
      <label>Bezugs-ID optional<input name="linkedEntityId" /></label>
      <label className="full-span">Beschreibung<textarea name="description" /></label>
      <button className="button full-span" type="submit">Speichern</button>
    </form>
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
