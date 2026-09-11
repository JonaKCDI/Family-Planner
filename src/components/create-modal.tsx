"use client";

import { PaymentMethodField } from "@/components/payment-method-field";

import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, ClipboardCheck, Euro, FileText, Fuel, Plus, Repeat2, ScrollText, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContract,
  createDocumentReference,
  createLocalDocumentReference,
  createExpense,
  quickCreateExpenseCategory,
  quickCreateExpenseLabel,
  createFuelEntry,
  createRecurringTransaction,
  createRecurringTask,
  createTask
} from "@/lib/actions";
import { enqueueOfflineExpenseCreate, enqueueOfflineTaskCreate } from "@/lib/offline-sync";
import { DocumentFilePicker } from "@/components/document-file-picker";
import { ModalPortal } from "@/components/modal-portal";
import { SearchableSelect } from "@/components/searchable-select";

type CreateModalProps = {
  categories: { id: string; name: string; color: string; icon: string }[];
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
  const [taskSheetTitle, setTaskSheetTitle] = useState("Aufgabe erstellen");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const selectedType = allowedTypes.some((item) => item.id === type) ? type : defaultType;
  function openCreateModal() {
    setType(defaultType);
    setFormStarted(allowedTypes.length <= 1);
    setTaskSheetTitle("Aufgabe erstellen");
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
        title={formStarted && selectedType === "task" ? taskSheetTitle : formStarted ? createTypes.find((item) => item.id === selectedType)?.label ?? "Neu erstellen" : "Neuen Eintrag erstellen"}
        description={!formStarted ? "Was möchtest du erfassen?" : undefined}
        leadingAction={allowedTypes.length > 1 && formStarted ? (
          <IconButton className="modal-back-button" type="button" label="Zur Auswahl" onClick={() => setFormStarted(false)}>
            <ArrowLeft size={19} aria-hidden="true" />
          </IconButton>
        ) : null}
        wide={formStarted}
        labelledById="create-modal-title"
        panelClassName={formStarted && selectedType === "contract" ? "contract-create-sheet" : undefined}
      >
              <div className={formStarted && selectedType === "contract" ? "create-dialog-body contract-create-dialog-body" : "create-dialog-body"}>
                {allowedTypes.length > 1 && !formStarted ? (
                  <div className="create-type-grid">
                    {allowedTypes.map((item) => (
                      <button
                        className={`create-type create-type-${item.tone}`}
                        type="button"
                        onClick={() => { setType(item.id); setFormStarted(true); if (item.id === "task") setTaskSheetTitle("Aufgabe erstellen"); }}
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
                {formStarted && selectedType === "task" ? <TaskForm members={members} documentRoots={documentRoots} today={today} onSheetTitleChange={setTaskSheetTitle} onSubmit={() => setOpen(false)} /> : null}
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
  const [planningRecurring, setPlanningRecurring] = useState(false);
  const [expenseKind, setExpenseKind] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [expensePanel, setExpensePanel] = useState<"main" | "document">("main");
  const showMainExpenseFields = expensePanel === "main" && !planningRecurring;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (planningRecurring && !navigator.onLine) {
      event.preventDefault();
      window.alert("Wiederkehrende Buchungen können nur online erstellt werden.");
      return;
    }
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
    <form action={planningRecurring ? createRecurringTransaction : createExpense} className="form form-grid modal-form finance-create-form" data-recurring={planningRecurring ? "true" : "false"} data-expense-panel={expensePanel} onSubmit={handleSubmit}>
      <input type="hidden" name="returnTo" value={returnTo} />
      {expensePanel === "document" ? (
        <div className="task-create-subhead full-span finance-document-subhead">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setExpensePanel("main")}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <strong>Beleg / Dokument</strong>
          </div>
          <span aria-hidden="true" />
        </div>
      ) : null}
      {planningRecurring ? (
        <div className="task-create-subhead full-span finance-recurring-subhead">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setPlanningRecurring(false)}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <strong>Wiederkehrende Buchung</strong>
          </div>
          <span aria-hidden="true" />
        </div>
      ) : null}
      <fieldset className="fieldset modal-form-section full-span finance-create-core" id="create-expense-core" hidden={expensePanel !== "main" || planningRecurring}>
        <legend>Buchung</legend>
        <div className="form-grid finance-create-grid">
          {planningRecurring ? <input type="hidden" name="title" value="" /> : null}
          <div className="finance-create-quick-grid full-span" hidden={!showMainExpenseFields}>
            {!planningRecurring ? (
              <div className="finance-kind-toggle finance-kind-compact" role="radiogroup" aria-label="Art der Buchung">
                <label><input name="kind" type="radio" value="EXPENSE" checked={expenseKind === "EXPENSE"} onChange={() => setExpenseKind("EXPENSE")} />Ausgabe</label>
                <label><input name="kind" type="radio" value="INCOME" checked={expenseKind === "INCOME"} onChange={() => setExpenseKind("INCOME")} />Einnahme</label>
              </div>
            ) : (
              <input type="hidden" name="kind" value={expenseKind} />
            )}
            <label>Betrag *<input name="amount" inputMode="decimal" placeholder="0,00 EUR" required /></label>
            <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
            <PaymentMethodField />
          </div>
          <label className="full-span" hidden={!showMainExpenseFields}>Beschreibung *<input name="description" placeholder="z. B. Supermarkt, Restaurant ..." required={!planningRecurring} /></label>
          <div hidden={!showMainExpenseFields}>
            <SearchableSelect name="categoryId" label="Kategorie" options={categories} emptyLabel="Keine Kategorie" placeholder="Kategorie auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
          </div>
          <div hidden={!showMainExpenseFields}>
            <SearchableSelect name="labelId" label="Label / Projekt" options={labels} emptyLabel="Kein Label" placeholder="Label auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
          </div>
          <label hidden={!showMainExpenseFields}>Geschäft / Anbieter<input name="store" placeholder="Rewe, Lidl, Amazon ..." /></label>
          {!planningRecurring ? <label hidden={!showMainExpenseFields}>Vertrag<select name="contractId" defaultValue=""><option value="">Kein Vertrag</option>{contracts.filter((contract) => contract.status === "ACTIVE").map((contract) => <option value={contract.id} key={contract.id}>{contract.provider} · {contract.contractType}</option>)}</select></label> : null}
          {!planningRecurring ? <label hidden={!showMainExpenseFields}>Sichtbarkeit<select name="scope" defaultValue="PRIVATE"><option value="PRIVATE">Privat</option><option value="FAMILY">Familie</option></select></label> : null}
        </div>
      </fieldset>
      {planningRecurring ? (
        <fieldset className="fieldset modal-form-section full-span task-create-options-page finance-recurring-page" id="create-recurring-expense" hidden={expensePanel !== "main"}>
          <legend>Wiederholung</legend>
          <div className="form-grid">
            <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
            <label>Zahlungsrhythmus<select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
            <label>Enddatum optional<input name="endDate" type="date" /></label>
            <label>Preis gilt ab<input name="priceValidFrom" type="date" defaultValue={today} /></label>
            <input type="hidden" name="status" value="ACTIVE" />
          </div>
          <p className="muted">Änderungen des Preises erzeugen später eine neue Preisphase. Zukünftige Buchungen werden nach den Regeln erstellt.</p>
        </fieldset>
      ) : null}
      {planningRecurring ? <input type="hidden" name="scope" value="PRIVATE" /> : null}
      {!planningRecurring ? (
        <div className="finance-create-actions full-span" hidden={expensePanel !== "main"}>
          <button className="flow-link" type="button" onClick={() => { setExpensePanel("main"); setPlanningRecurring(true); }}>
            <Repeat2 size={18} aria-hidden="true" />
            <span>Wiederkehrend planen</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button className="flow-link" type="button" onClick={() => setExpensePanel("document")}>
            <FileText size={18} aria-hidden="true" />
            <span>Beleg verknüpfen</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {!planningRecurring ? <fieldset className="fieldset modal-form-section full-span task-create-options-page finance-document-page" id="create-expense-document" hidden={expensePanel !== "document"}>
        <legend>Beleg / Dokument</legend>
        <div className="form-grid">
          <label>Dokumenttitel<input name="documentTitle" placeholder="Rechnung, Beleg, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </fieldset> : null}
      <div className="modal-submit-row modal-footer">
        {expensePanel === "document" ? (
          <button className="button full-span" type="button" onClick={() => setExpensePanel("main")}>Übernehmen</button>
        ) : (
          <>
            {planningRecurring ? <button className="button secondary" type="button" onClick={() => setPlanningRecurring(false)}>Zurück</button> : null}
            <button className="button full-span" type="submit">{planningRecurring ? "Serie speichern" : "Buchung speichern"}</button>
          </>
        )}
      </div>
      {expensePanel === "document" ? <div className="document-line-art" aria-hidden="true" /> : null}
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
  const [fuelPanel, setFuelPanel] = useState<"main" | "document">("main");
  if (cars.length === 0) {
    return <div className="empty">Noch kein aktives Auto vorhanden. Admins können Autos im Kilometer-Setup anlegen.</div>;
  }

  return (
    <form action={createFuelEntry} className="form form-grid modal-form finance-create-form fuel-create-form" data-fuel-panel={fuelPanel} onSubmit={onSubmit}>
      <input type="hidden" name="returnTo" value={returnTo} />
      {fuelPanel === "document" ? (
        <div className="task-create-subhead full-span fuel-create-subhead">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setFuelPanel("main")}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <strong>Beleg / Dokument</strong>
          </div>
          <span aria-hidden="true" />
        </div>
      ) : null}
      <fieldset className="fieldset modal-form-section full-span finance-create-core fuel-create-core" id="create-fuel-stop" hidden={fuelPanel !== "main"}>
        <legend>Tankstopp</legend>
        <div className="form-grid finance-create-grid fuel-create-grid">
          <label>
            Auto
            <select name="carId" defaultValue={cars[0]?.id ?? ""} required>
              {cars.map((car) => <option value={car.id} key={car.id}>{car.name}{car.licensePlate ? ` · ${car.licensePlate}` : ""}</option>)}
            </select>
          </label>
          <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
          <div className="fuel-measure-row full-span">
            <label>Kilometerstand<input name="odometerKm" type="number" inputMode="numeric" min="0" required /></label>
            <label>Liter<input name="liters" inputMode="decimal" placeholder="45,34" required /></label>
          </div>
          <div className="fuel-booking-row full-span">
            <label>Betrag in EUR<input name="cost" inputMode="decimal" placeholder="71,01" required /></label>
            <div className="finance-kind-toggle finance-kind-compact fuel-expense-segment" role="radiogroup" aria-label="Tankstopp als Ausgabe buchen">
              <label><input name="createExpenseFromFuel" type="radio" value="off" checked={!bookExpense} onChange={() => setBookExpense(false)} />Nur Tank</label>
              <label><input name="createExpenseFromFuel" type="radio" value="on" checked={bookExpense} onChange={() => setBookExpense(true)} />Ausgabe</label>
            </div>
          </div>
          <label className="full-span">Bemerkung<input name="note" placeholder="Urlaub, bezahlt von ..., Werkstatt ..." /></label>
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span fuel-expense-page" id="create-fuel-expense" hidden={fuelPanel !== "main"}>
        <legend>Ausgabe</legend>
        {bookExpense ? (
          <div className="form-grid">
            <SearchableSelect name="expenseCategoryId" label="Kategorie" options={categories} defaultValue={settings?.defaultCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
            <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} defaultValue={settings?.defaultLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
            <PaymentMethodField name="expensePaymentMethod" defaultValue={settings?.defaultPaymentMethod ?? ""} />
            <label>Laden<input name="expenseStore" defaultValue={settings?.defaultStore ?? ""} placeholder="Tankstelle oder Händler" /></label>
            <label className="full-span">Beschreibung<input name="expenseDescription" defaultValue={settings?.defaultDescription ?? ""} /></label>
          </div>
        ) : null}
      </fieldset>
      {bookExpense ? <fieldset className="fieldset modal-form-section full-span task-create-options-page finance-document-page fuel-document-page" id="create-fuel-document" hidden={fuelPanel !== "document"}>
        <legend>Beleg / Dokument</legend>
        <div className="form-grid">
          <label>Dokumenttitel<input name="documentTitle" placeholder="Rechnung, Beleg, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </fieldset> : null}
      <div className="finance-create-actions fuel-create-actions full-span" hidden={fuelPanel !== "main"}>
        {bookExpense ? (
          <button className="flow-link" type="button" onClick={() => setFuelPanel("document")}>
            <FileText size={18} aria-hidden="true" />
            <span>Beleg verknüpfen</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="modal-submit-row modal-footer">
        {fuelPanel === "main" ? (
          <button className="button full-span" type="submit">Tankstopp speichern</button>
        ) : (
          <button className="button full-span" type="button" onClick={() => setFuelPanel("main")}>Übernehmen</button>
        )}
      </div>
      {fuelPanel === "document" ? <div className="document-line-art" aria-hidden="true" /> : null}
    </form>
  );
}

function TaskForm({
  members,
  documentRoots,
  today,
  onSheetTitleChange,
  onSubmit
}: {
  members: CreateModalProps["members"];
  documentRoots: CreateModalProps["documentRoots"];
  today: string;
  onSheetTitleChange: (title: string) => void;
  onSubmit: () => void;
}) {
  const [recurrencePreset, setRecurrencePreset] = useState("NONE");
  const [customIntervalUnit, setCustomIntervalUnit] = useState("DAY");
  const [step, setStep] = useState<"details" | "repeat">("details");
  const [taskPanel, setTaskPanel] = useState<"main" | "options">("main");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskStartDate, setTaskStartDate] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const isRecurring = recurrencePreset !== "NONE";
  const customIntervalMax = customIntervalUnit === "WEEK" ? 52 : 365;
  const selectedStartDate = taskStartDate || taskDueDate || (isRecurring ? today : "");

  function continueToRepeat() {
    if (!formRef.current?.reportValidity()) return;
    if (recurrencePreset === "NONE") setRecurrencePreset("WEEKLY");
    if (!taskStartDate) setTaskStartDate(today);
    setStep("repeat");
    setTaskPanel("main");
    onSheetTitleChange("Wiederkehrende Aufgabe");
  }

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
    <form ref={formRef} action={isRecurring ? createRecurringTask : createTask} className="form form-grid modal-form task-create-form" data-task-view={taskPanel === "options" ? "options" : step} onSubmit={handleSubmit}>
      {taskPanel === "options" ? (
        <div className="task-create-subhead full-span">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setTaskPanel("main")}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <strong>Weitere Optionen</strong>
          </div>
          <span aria-hidden="true" />
        </div>
      ) : null}
      {taskPanel === "main" && step === "repeat" ? (
        <div className="task-create-subhead full-span">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => { setStep("details"); onSheetTitleChange("Aufgabe erstellen"); }}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <strong>Wiederholung</strong>
          </div>
          <span aria-hidden="true" />
        </div>
      ) : null}
      <fieldset className="fieldset modal-form-section full-span task-create-core" id="create-task-core" hidden={taskPanel !== "main" || step === "repeat"}>
        <legend>Aufgabe</legend>
        <label className="full-span">Titel *<input name="title" required placeholder="Was ist zu erledigen?" value={taskTitle} onChange={(event) => setTaskTitle(event.currentTarget.value)} /></label>
        <label>Fällig am<input name="dueDate" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.currentTarget.value)} /></label>
        <label>Zuständig<select name="assignedToUserId" defaultValue=""><option value="">Nicht zugewiesen</option>{members.map((member) => <option value={member.userId} key={member.id}>{member.user.name}</option>)}</select></label>
        <label>Priorität<select name="priority" defaultValue="MEDIUM"><option value="LOW">Niedrig</option><option value="MEDIUM">Mittel</option><option value="HIGH">Hoch</option><option value="URGENT">Dringend</option></select></label>
        <label className="full-span">Notiz<textarea name="description" placeholder="Optional" /></label>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span" id="create-task-repeat" hidden={taskPanel !== "main" || !isRecurring || step !== "repeat"}>
        <legend>Wiederholung</legend>
        <div className="task-repeat-grid">
          <label>
            Wiederholt sich
            <select name="recurrencePreset" value={recurrencePreset} onChange={(event) => setRecurrencePreset(event.currentTarget.value)}>
              <option value="DAILY">Täglich</option>
              <option value="WEEKLY">Wöchentlich</option>
              <option value="MONTHLY">Monatlich</option>
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
          {recurrencePreset !== "CUSTOM" ? <input name="intervalCount" type="hidden" value="1" /> : null}
          {recurrencePreset !== "CUSTOM" ? <input name="intervalUnit" type="hidden" value={recurrencePreset === "YEARLY" ? "YEAR" : recurrencePreset === "MONTHLY" ? "MONTH" : recurrencePreset === "WEEKLY" ? "WEEK" : "DAY"} /> : null}
          <label>Startdatum<input name="startDate" type="date" value={selectedStartDate} required onChange={(event) => setTaskStartDate(event.currentTarget.value)} /></label>
          {isRecurring ? <label>Enddatum optional<input name="endDate" type="date" /></label> : null}
          {isRecurring ? <label>Aufgabe anzeigen<select name="leadTimeDays" defaultValue="2"><option value="0">Am Fälligkeitstag</option><option value="1">1 Tag vorher</option><option value="2">2 Tage vorher</option><option value="3">3 Tage vorher</option><option value="7">7 Tage vorher</option></select></label> : null}
        </div>
      </fieldset>
      <button className="task-options-link full-span" type="button" hidden={taskPanel !== "main" || step === "repeat"} onClick={() => setTaskPanel("options")}>
        <span>Weitere Optionen</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <fieldset className="fieldset modal-form-section full-span task-create-options-page" hidden={taskPanel !== "options"}>
        <legend>Weitere Optionen</legend>
        <div className="form-grid">
          <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
          <label>Dokumenttitel<input name="documentTitle" placeholder="Anleitung, Foto, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </fieldset>
      {taskPanel === "main" && step !== "repeat" ? (
        <button className="task-recurring-link full-span" type="button" onClick={continueToRepeat}>
          <Repeat2 size={18} aria-hidden="true" />
          <span>Als wiederkehrende Aufgabe planen</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : null}
      <div className="modal-submit-row modal-footer">
        {taskPanel === "options" ? (
          <button className="button" type="button" onClick={() => setTaskPanel("main")}>Übernehmen</button>
        ) : (
          <>
            <button className="button" type="submit">{isRecurring ? "Serie speichern" : "Aufgabe erstellen"}</button>
          </>
        )}
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
  const [panel, setPanel] = useState<"main" | "auto" | "term" | "document">("main");
  const day = new Date(`${today}T00:00:00`).getDate();
  const panelTitle = panel === "auto" ? "Automatische Ausgabe" : panel === "term" ? "Laufzeit & Kündigung" : panel === "document" ? "Beleg / Dokument" : null;

  return (
    <form action={createContract} className="form form-grid modal-form task-create-form finance-create-form contract-create-form" data-task-view={panel === "main" ? "details" : panel} data-contract-panel={panel} onSubmit={onSubmit}>
      <input type="hidden" name="priceValidFrom" value={today} />
      <input type="hidden" name="priceChangeMode" value="NEW_PHASE" />
      {panelTitle ? (
        <div className="task-create-subhead full-span contract-create-subhead">
          <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setPanel("main")}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <strong>{panelTitle}</strong>
          </div>
          <span aria-hidden="true" />
        </div>
      ) : null}
      <fieldset className="fieldset modal-form-section full-span task-create-core contract-create-core" id="create-contract-core" hidden={panel !== "main"}>
        <legend>Vertrag</legend>
        <div className="form-grid contract-create-grid">
          <label className="full-span">Anbieter *<input name="provider" placeholder="Telekom, Allianz, Netflix ..." required /></label>
          <label className="full-span">Vertragsart *<input name="contractType" placeholder="Mobilfunk, Versicherung, Abo ..." required /></label>
          <div className="contract-date-cost-row full-span">
            <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
            <label>Kosten in EUR *<input name="cost" inputMode="decimal" placeholder="29,99" required /></label>
          </div>
          <div className="contract-rhythm-status-row full-span">
            <label>
              Zahlungsrhythmus
              <select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="YEARLY">Jährlich</option><option value="QUARTERLY">Quartalsweise</option><option value="ONCE">Einmalig</option><option value="OTHER">Sonstiges</option></select>
            </label>
            <label>Status<select name="status" defaultValue="ACTIVE"><option value="ACTIVE">Aktiv</option><option value="DRAFT">Entwurf</option><option value="CANCELLED">Gekündigt</option><option value="EXPIRED">Ausgelaufen</option></select></label>
          </div>
          <label className="full-span">Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
        </div>
      </fieldset>
      <div className="finance-create-actions contract-flow-links full-span" hidden={panel !== "main"}>
        <button className="flow-link" type="button" onClick={() => setPanel("auto")}>
          <Repeat2 size={17} aria-hidden="true" />
          <span>Automatische Ausgabe</span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
        <button className="flow-link" type="button" onClick={() => setPanel("term")}>
          <ScrollText size={17} aria-hidden="true" />
          <span>Laufzeit & Kündigung</span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
        <button className="flow-link" type="button" onClick={() => setPanel("document")}>
          <FileText size={17} aria-hidden="true" />
          <span>Beleg / Dokument</span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <label className="full-span" hidden={panel !== "main"}>Notizen<textarea name="description" /></label>

      <fieldset className="fieldset modal-form-section full-span task-create-options-page contract-auto-page" id="create-contract-auto" hidden={panel !== "auto"}>
        <legend>Automatische Ausgabe</legend>
        <div className="form-grid">
          <label className="checkbox-field full-span"><input name="autoCreateExpenses" type="checkbox" /> Automatisch als Ausgabe eintragen</label>
          <label>Einzugstag<input name="expensePaymentDay" type="number" min="1" max="31" defaultValue={day} /></label>
          <SearchableSelect name="expenseCategoryId" label="Ausgaben-Kategorie" options={categories} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
          <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span task-create-options-page contract-term-page" id="create-contract-term" hidden={panel !== "term"}>
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
      <fieldset className="fieldset modal-form-section full-span task-create-options-page finance-document-page contract-document-page" id="create-contract-document" hidden={panel !== "document"}>
        <legend>Beleg / Dokument</legend>
        <div className="form-grid">
          <label>Dokumenttitel<input name="documentTitle" placeholder="Vertrag, Rechnung, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://drive.google.com/..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </fieldset>
      {panel === "auto" ? <div className="contract-auto-line-art" aria-hidden="true" /> : null}
      {panel === "document" ? <div className="document-line-art" aria-hidden="true" /> : null}
      <div className="modal-submit-row modal-footer">
        {panel === "main" ? (
          <button className="button full-span" type="submit">Vertrag speichern</button>
        ) : (
          <button className="button full-span" type="button" onClick={() => setPanel("main")}>Übernehmen</button>
        )}
      </div>
    </form>
  );
}

function DocumentForm({ documentRoots, onSubmit }: { documentRoots: CreateModalProps["documentRoots"]; onSubmit: () => void }) {
  const [source, setSource] = useState<"link" | "file">("file");
  const [panel, setPanel] = useState<"main" | "details">("main");
  const linkSelected = source === "link";

  return (
    <div className="form form-grid modal-form document-create-form">
      {!linkSelected ? (
        <form action={createLocalDocumentReference} className="form form-grid modal-form full-span document-create-source-form" onSubmit={onSubmit}>
          {panel === "details" ? <DocumentDetailsSubhead onBack={() => setPanel("main")} /> : null}
          <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "main"}>
            <legend>Dokument</legend>
            <DocumentFilePicker roots={documentRoots} />
            {documentRoots.length === 0 ? (
              <p className="muted">Ein Admin muss zuerst in den Einstellungen einen Dokumentbereich freigeben.</p>
            ) : null}
          </fieldset>
          <button className="flow-link document-more-details-link full-span" type="button" hidden={panel !== "main"} onClick={() => setPanel("details")}>
            <span>Weitere Angaben</span>
            <small>Zuordnung, Sichtbarkeit und Beschreibung</small>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button className="flow-link document-link-source-link full-span" type="button" hidden={panel !== "main"} onClick={() => { setSource("link"); setPanel("main"); }}>
            <span>HTTPS-Link statt NAS-Datei</span>
            <small>Für sichere Links zu Drive, WebDAV oder Synology.</small>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
            <legend>Zuordnung</legend>
            <div className="form-grid">
              <label>Titel optional<input name="title" placeholder="Leer lassen, um den Dateinamen zu verwenden" /></label>
              <label>Bezug<select name="linkedEntityType" defaultValue="GENERAL"><option value="GENERAL">Allgemein</option><option value="EXPENSE">Ausgabe</option><option value="TASK">Aufgabe</option><option value="CONTRACT">Vertrag</option></select></label>
              <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
              <label className="document-advanced-link-id">Interne Bezugs-ID optional<input name="linkedEntityId" /></label>
            </div>
          </fieldset>
          <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
            <legend>Details</legend>
            <label>Beschreibung<textarea name="description" /></label>
          </fieldset>
          <div className="modal-submit-row modal-footer">
            <button className="button full-span" type="submit" disabled={documentRoots.length === 0}>Speichern</button>
          </div>
        </form>
      ) : null}
      {linkSelected ? (
        <form action={createDocumentReference} className="form form-grid modal-form full-span document-create-source-form" onSubmit={onSubmit}>
          {panel === "details" ? <DocumentDetailsSubhead onBack={() => setPanel("main")} /> : <DocumentDetailsSubhead title="HTTPS-Link speichern" onBack={() => setSource("file")} />}
          <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "main"}>
            <legend>Dokument</legend>
            <div className="form-grid">
              <input type="hidden" name="referenceType" value="EXTERNAL_URL" />
              <label>Titel<input name="title" required /></label>
              <label>HTTPS-Link<input name="url" type="url" placeholder="https://drive.google.com/..." required /></label>
            </div>
          </fieldset>
          <button className="flow-link document-more-details-link full-span" type="button" hidden={panel !== "main"} onClick={() => setPanel("details")}>
            <span>Weitere Angaben</span>
            <small>Zuordnung, Sichtbarkeit und Beschreibung</small>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
            <legend>Zuordnung</legend>
            <div className="form-grid">
              <label>Bezug<select name="linkedEntityType" defaultValue="GENERAL"><option value="GENERAL">Allgemein</option><option value="EXPENSE">Ausgabe</option><option value="TASK">Aufgabe</option><option value="CONTRACT">Vertrag</option></select></label>
              <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
              <label className="document-advanced-link-id">Interne Bezugs-ID optional<input name="linkedEntityId" /></label>
            </div>
          </fieldset>
          <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
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

function DocumentDetailsSubhead({ onBack, title = "Weitere Angaben" }: { onBack: () => void; title?: string }) {
  return (
    <div className="task-create-subhead full-span document-details-subhead">
      <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <strong>{title}</strong>
      <span aria-hidden="true" />
    </div>
  );
}

function FloatingActionButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button className={["fab-button", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </button>
  );
}

function IconButton({
  className,
  children,
  label,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; label: string }) {
  return (
    <button className={["icon-button", className].filter(Boolean).join(" ")} aria-label={label} title={title ?? label} {...props}>
      {children}
    </button>
  );
}

function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  leadingAction,
  wide = false,
  labelledById,
  panelClassName,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  leadingAction?: ReactNode;
  wide?: boolean;
  labelledById: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const [closing, setClosing] = useState(false);

  function closeSheet() {
    setClosing(true);
    window.setTimeout(() => {
      onOpenChange(false);
      setClosing(false);
    }, 180);
  }

  if (!open && !closing) return null;

  return (
    <ModalPortal>
      <div className={closing ? "modal-backdrop is-closing" : "modal-backdrop"} role="presentation">
        <section className={["modal-panel create-dialog create-from-fab", wide ? "action-modal-wide" : null, panelClassName].filter(Boolean).join(" ")} role="dialog" aria-modal="true" aria-labelledby={labelledById}>
          {leadingAction}
          <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={closeSheet}>
            <X size={20} />
          </button>
          <div className="modal-head">
            <div>
              <h2 id={labelledById}>{title}</h2>
              {description ? <p className="muted">{description}</p> : null}
            </div>
          </div>
          {children}
        </section>
      </div>
    </ModalPortal>
  );
}
