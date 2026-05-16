"use client";

import { useState } from "react";
import { deleteExpense, updateExpense } from "@/lib/actions";
import type { ExpenseDocumentItem, ExpenseListItem } from "@/lib/expense-list";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { ActionModal } from "@/components/action-modal";

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
  categories: ExpenseEntryOption[];
  labels: ExpenseEntryOption[];
  contracts: ExpenseEntryContractOption[];
  initialDocumentsByExpense: Record<string, ExpenseDocumentItem[]>;
  loadUrl: string;
  pageSize?: number;
};

export function ExpenseEntryList({
  initialEntries,
  totalCount,
  categories,
  labels,
  contracts,
  initialDocumentsByExpense,
  loadUrl,
  pageSize = 100
}: ExpenseEntryListProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [documentsByExpense, setDocumentsByExpense] = useState(initialDocumentsByExpense);
  const [loading, setLoading] = useState(false);
  const hasMore = entries.length < totalCount;

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const url = new URL(loadUrl, window.location.origin);
      url.searchParams.set("offset", String(entries.length));
      url.searchParams.set("limit", String(pageSize));
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Nachladen fehlgeschlagen.");
      const payload = await response.json() as { entries: ExpenseListItem[]; documentsByExpense: Record<string, ExpenseDocumentItem[]> };
      setEntries((current) => [...current, ...payload.entries]);
      setDocumentsByExpense((current) => ({ ...current, ...payload.documentsByExpense }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="expense-list">
      {entries.map((expense) => (
        <ExpenseEntryRow
          expense={expense}
          linkedDocuments={documentsByExpense[expense.id] ?? []}
          categories={categories}
          labels={labels}
          contracts={contracts}
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
  categories,
  labels,
  contracts
}: {
  expense: ExpenseListItem;
  linkedDocuments: ExpenseDocumentItem[];
  categories: ExpenseEntryOption[];
  labels: ExpenseEntryOption[];
  contracts: ExpenseEntryContractOption[];
}) {
  const [loaded, setLoaded] = useState(false);
  const primaryDocument = linkedDocuments[0];

  return (
    <details className="expense-row" onToggle={(event) => { if (event.currentTarget.open) setLoaded(true); }}>
      <summary>
        <span>{formatDate(expense.date)}</span>
        <span>
          {expense.description}
          <small>{[expense.store, expense.paymentMethod].filter(Boolean).join(" · ")}</small>
        </span>
        <span className="expense-overview-tags">
          <span className="overview-tag" style={expense.category ? { borderColor: expense.category.color } : undefined}>
            {expense.category?.name ?? "Ohne Kategorie"}
          </span>
          {expense.label ? <span className="overview-tag label-overview-tag" style={{ background: expense.label.color }}>{expense.label.name}</span> : null}
          {expense.contract ? <span className="overview-tag">{expense.contract.provider}</span> : null}
        </span>
        <strong className={expense.kind === "INCOME" ? "positive" : "negative"}>
          {expense.kind === "INCOME" ? "+" : "-"}{formatMoney(expense.amountCents, expense.currency)}
        </strong>
      </summary>
      {loaded ? (
        <div className="expense-detail">
          <div className="expense-detail-meta">
            <span className="badge">{expense.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</span>
            <span className="badge">{expense.paymentMethod}</span>
            {expense.store ? <span className="badge">{expense.store}</span> : null}
            {expense.category ? <span className="badge" style={{ borderColor: expense.category.color }}>{expense.category.name}</span> : null}
            {expense.label ? <span className="badge label-badge" style={{ background: expense.label.color }}>{expense.label.name}</span> : null}
            {expense.contract ? <span className="badge">Vertrag: {expense.contract.provider} · {expense.contract.contractType}</span> : null}
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
              <button className="button secondary danger-subtle" type="submit">Löschen</button>
            </form>
            <ActionModal title="Eintrag bearbeiten" trigger="Bearbeiten">
              <form action={updateExpense} className="form form-grid modal-form">
                <input type="hidden" name="id" value={expense.id} />
                <label>
                  Art
                  <select name="kind" defaultValue={expense.kind}>
                    <option value="EXPENSE">Ausgabe</option>
                    <option value="INCOME">Einnahme</option>
                  </select>
                </label>
                <label>Betrag in EUR<input name="amount" inputMode="decimal" defaultValue={formatEuroInput(expense.amountCents)} required /></label>
                <label>Datum<input name="date" type="date" defaultValue={toDateInputValue(expense.date)} required /></label>
                <label>Beschreibung<input name="description" defaultValue={expense.description} required /></label>
                <label>Bezahlart<input name="paymentMethod" list="payment-methods" defaultValue={expense.paymentMethod} /></label>
                <label>Laden<input name="store" defaultValue={expense.store} placeholder="Rewe, Lidl, Amazon ..." /></label>
                <label>
                  Kategorie
                  <select name="categoryId" defaultValue={expense.categoryId ?? ""}>
                    <option value="">Keine Kategorie</option>
                    {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label>
                  Label / Projekt
                  <select name="labelId" defaultValue={expense.labelId ?? ""}>
                    <option value="">Kein Label</option>
                    {labels.map((label) => <option value={label.id} key={label.id}>{label.name}</option>)}
                  </select>
                </label>
                <label>
                  Vertrag
                  <select name="contractId" defaultValue={expense.contractId ?? ""}>
                    <option value="">Kein Vertrag</option>
                    {contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.provider} · {contract.contractType}</option>)}
                  </select>
                </label>
                <PaymentMethods />
                <fieldset className="fieldset full-span">
                  <legend>Drive-Link optional verknüpfen</legend>
                  <input type="hidden" name="documentId" value={primaryDocument?.id ?? ""} />
                  <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.title ?? ""} placeholder="Rechnung, Beleg, Nachweis ..." /></label>
                  <label>Drive-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
                </fieldset>
                <button className="button full-span" type="submit">Änderungen speichern</button>
              </form>
            </ActionModal>
          </div>
        </div>
      ) : null}
    </details>
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
