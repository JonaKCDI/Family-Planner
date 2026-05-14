"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { ClipboardCheck, Euro, FileText, Plus, ScrollText, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContract,
  createDocumentReference,
  createExpense,
  createTask
} from "@/lib/actions";
import { enqueueOfflineExpenseCreate, enqueueOfflineTaskCreate } from "@/lib/offline-sync";

type CreateModalProps = {
  categories: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  members: { id: string; userId: string; user: { name: string } }[];
};

type CreateType = "expense" | "task" | "contract" | "document";

const createTypes = [
  { id: "expense", label: "Ausgabe", detail: "Ausgabe oder Einnahme erfassen", icon: Euro },
  { id: "task", label: "Aufgabe", detail: "To-do mit Priorität und Deadline", icon: ClipboardCheck },
  { id: "contract", label: "Vertrag", detail: "Abo, Versicherung oder Frist", icon: ScrollText },
  { id: "document", label: "Dokument", detail: "HTTPS-Verweis speichern", icon: FileText }
] satisfies { id: CreateType; label: string; detail: string; icon: typeof Euro }[];

const typeByPath: Record<string, CreateType> = {
  "/ausgaben": "expense",
  "/aufgaben": "task",
  "/vertraege": "contract",
  "/dokumente": "document"
};

export function CreateModal({ categories, labels, members }: CreateModalProps) {
  const pathname = usePathname();
  const pageType = typeByPath[pathname];
  const shouldShow = pathname === "/dashboard" || Boolean(pageType);
  const allowedTypes = pathname === "/dashboard" ? createTypes : createTypes.filter((item) => item.id === pageType);
  const defaultType = allowedTypes[0]?.id ?? "expense";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CreateType>(defaultType);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const selectedType = allowedTypes.some((item) => item.id === type) ? type : defaultType;

  if (!shouldShow) return null;

  return (
    <>
      <button
        className="fab-button"
        type="button"
        aria-label="Neu erstellen"
        title="Neu erstellen"
        onClick={() => {
          setType(defaultType);
          setOpen(true);
        }}
      >
        <Plus aria-hidden="true" size={28} strokeWidth={2.4} />
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
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
            {selectedType === "expense" ? <ExpenseForm categories={categories} labels={labels} today={today} onSubmit={() => setOpen(false)} /> : null}
            {selectedType === "task" ? <TaskForm members={members} onSubmit={() => setOpen(false)} /> : null}
            {selectedType === "contract" ? <ContractForm today={today} onSubmit={() => setOpen(false)} /> : null}
            {selectedType === "document" ? <DocumentForm onSubmit={() => setOpen(false)} /> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function ExpenseForm({ categories, labels, today, onSubmit }: { categories: CreateModalProps["categories"]; labels: CreateModalProps["labels"]; today: string; onSubmit: () => void }) {
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
      <label>Art<select name="kind" defaultValue="EXPENSE"><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
      <label>Betrag in EUR<input name="amount" inputMode="decimal" placeholder="42,50" required /></label>
      <label>Datum<input name="date" type="date" defaultValue={today} required /></label>
      <label>Bezahlart<input name="paymentMethod" list="payment-methods" placeholder="Karte, Bar, Überweisung ..." /></label>
      <label>Kategorie<select name="categoryId" defaultValue=""><option value="">Keine Kategorie</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      <label>Label / Projekt<select name="labelId" defaultValue=""><option value="">Kein Label</option>{labels.map((label) => <option value={label.id} key={label.id}>{label.name}</option>)}</select></label>
      <label>Beschreibung<input name="description" placeholder="Wocheneinkauf, Dienstreise, Rückerstattung ..." required /></label>
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

function TaskForm({ members, onSubmit }: { members: CreateModalProps["members"]; onSubmit: () => void }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    <form action={createTask} className="form form-grid modal-form" onSubmit={handleSubmit}>
      <label>Titel<input name="title" required /></label>
      <label>Zuweisen an<select name="assignedToUserId" defaultValue=""><option value="">Nicht zugewiesen</option>{members.map((member) => <option value={member.userId} key={member.id}>{member.user.name}</option>)}</select></label>
      <label>Deadline<input name="dueDate" type="date" /></label>
      <label>Priorität<select name="priority" defaultValue="MEDIUM"><option value="LOW">Niedrig</option><option value="MEDIUM">Mittel</option><option value="HIGH">Hoch</option><option value="URGENT">Dringend</option></select></label>
      <label>Sichtbarkeit<select name="scope" defaultValue="FAMILY"><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
      <label className="full-span">Beschreibung<textarea name="description" /></label>
      <button className="button full-span" type="submit">Speichern</button>
    </form>
  );
}

function ContractForm({ today, onSubmit }: { today: string; onSubmit: () => void }) {
  return (
    <form action={createContract} className="form form-grid modal-form" onSubmit={onSubmit}>
      <label>Anbieter<input name="provider" required /></label>
      <label>Vertragsart<input name="contractType" placeholder="Mobilfunk, Versicherung, Abo ..." required /></label>
      <label>Kosten in EUR<input name="cost" inputMode="decimal" placeholder="29,99" required /></label>
      <label>Intervall<select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="YEARLY">Jährlich</option><option value="QUARTERLY">Quartalsweise</option><option value="ONCE">Einmalig</option><option value="OTHER">Sonstiges</option></select></label>
      <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
      <label>Ende/Laufzeit bis<input name="endDate" type="date" /></label>
      <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" /></label>
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
