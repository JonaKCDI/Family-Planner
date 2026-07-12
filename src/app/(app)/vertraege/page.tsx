import { updateContract } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getContractNextCancellationDate, toAnnualCancellationInputValue } from "@/lib/contracts";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { getDocumentsForLinkedEntities, getExpenseLabels, getVisibleCategories, getVisibleContractPayments, getVisibleContractsWithExpenseDetails } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { ContractPayments } from "@/components/contract-payments";
import { SearchableSelect } from "@/components/searchable-select";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";
import { Search } from "lucide-react";

type ContractsPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  await ensureDueContractExpenses(session.family.id, session.user.id);
  const query = normalizeSearch(params.q);
  const statusFilter = getContractStatusFilter(params.status) ?? "ACTIVE";
  const [contracts, categories, labels] = await Promise.all([
    getVisibleContractsWithExpenseDetails(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id)
  ]);
  const statusFilteredContracts = statusFilter === "ENDED"
    ? contracts.filter((contract) => contract.status === "CANCELLED" || contract.status === "EXPIRED")
    : contracts.filter((contract) => contract.status === statusFilter);
  const visibleContracts = query ? statusFilteredContracts.filter((contract) => matchesContract(contract, query)) : statusFilteredContracts;
  const documents = await getDocumentsForLinkedEntities(
    session.family.id,
    session.user.id,
    "CONTRACT",
    visibleContracts.map((contract) => contract.id)
  );
  const documentsByContract = documents.reduce<Record<string, typeof documents>>((groups, document) => {
    const key = document.linkedEntityId ?? "";
    groups[key] = [...(groups[key] ?? []), document];
    return groups;
  }, {});
  const payments = await getVisibleContractPayments(
    session.family.id,
    session.user.id,
    visibleContracts.map((contract) => contract.id)
  );
  const paymentsByContract = payments.reduce<Record<string, typeof payments>>((groups, payment) => {
    const key = payment.contractId ?? "";
    groups[key] = [...(groups[key] ?? []), payment];
    return groups;
  }, {});
  const activeCosts = visibleContracts
    .filter((contract) => contract.status === "ACTIVE")
    .reduce((sum, contract) => sum + contract.costCents, 0);
  const nextCancellationByContract = Object.fromEntries(
    visibleContracts.map((contract) => [contract.id, getContractNextCancellationDate(contract)])
  );
  const nextCancellationDate = visibleContracts
    .map((contract) => nextCancellationByContract[contract.id])
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <>
      <PageHeader title="Verträge" />
      <details className="compact-search page-search" open={Boolean(query)}>
        <summary aria-label="Verträge durchsuchen" title="Suchen"><Search aria-hidden="true" size={19} /></summary>
        <form className="search-bar">
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <label>
            <span>Verträge durchsuchen</span>
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Anbieter, Art, Notiz, Status ..." autoFocus={Boolean(query)} />
          </label>
          <button className="button secondary" type="submit">Suchen</button>
          {query ? <a className="button secondary" href={buildContractsHref({ status: statusFilter })}>Suche schließen</a> : null}
        </form>
      </details>
      <section className="stats">
        <div className="stat"><span>Aktive Kosten</span><strong>{formatMoney(activeCosts)}</strong></div>
        <div className="stat"><span>Verträge</span><strong>{visibleContracts.length}</strong></div>
        <div className="stat"><span>Aktiv</span><strong>{visibleContracts.filter((contract) => contract.status === "ACTIVE").length}</strong></div>
        <div className="stat"><span>Nächste Kündigung</span><strong>{formatDate(nextCancellationDate)}</strong></div>
      </section>
      <nav className="section-switcher status-filter-strip" aria-label="Vertragsstatus">
        <a className={statusFilter === "ACTIVE" ? "active" : ""} href={buildContractsHref({ q: params.q, status: "ACTIVE" })}>Aktiv</a>
        <a className={statusFilter === "ENDED" ? "active" : ""} href={buildContractsHref({ q: params.q, status: "ENDED" })}>Beendet</a>
      </nav>
      <details className="secondary-status-filter">
        <summary>Weitere Filter</summary>
        <div className="badge-row">
          <a className="badge" href={buildContractsHref({ q: params.q, status: "DRAFT" })}>Entwürfe</a>
          <a className="badge" href={buildContractsHref({ q: params.q, status: "CANCELLED" })}>Gekündigt</a>
          <a className="badge" href={buildContractsHref({ q: params.q, status: "EXPIRED" })}>Ausgelaufen</a>
          <a className="badge" href={buildContractsHref({ q: params.q, status: undefined })}>Alle Status</a>
        </div>
      </details>
      <section className="panel">
        <h2 className="section-title">Vertragsübersicht</h2>
        <div className="list">
          {visibleContracts.length === 0 ? <EmptyState>{query ? "Keine passenden Verträge gefunden." : "Noch keine Verträge erfasst."}</EmptyState> : null}
          {visibleContracts.map((contract) => {
            const linkedDocuments = documentsByContract[contract.id] ?? [];
            const primaryDocument = linkedDocuments[0];
            const contractPayments = paymentsByContract[contract.id] ?? [];
            const paymentTotal = contractPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
            const nextCancellation = nextCancellationByContract[contract.id];
            const currentPricePhase = contract.pricePhases.at(-1);
            return (
              <details className="card contract-card" key={contract.id}>
                <summary className="contract-summary">
                  <div>
                    <div className="contract-title-row">
                      <strong>{contract.provider}</strong>
                      <span className="muted">{contract.contractType} · {billingLabels[contract.billingInterval]} · {contract.owner.name}</span>
                    </div>
                    <p>{formatMoney(contract.costCents, contract.currency)} · Kündigung spätestens: {formatDate(nextCancellation)}</p>
                    <div className="badge-row">
                      <span className="badge">{statusLabels[contract.status]}</span>
                      <span className="badge">{contract.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                      {contract.autoRenewal ? <span className="badge">Verlängert sich {renewalLabels[contract.renewalInterval]}</span> : null}
                      {contract.autoCreateExpenses ? <span className="badge">Auto-Ausgabe am {contract.expensePaymentDay ?? new Date(contract.startDate).getDate()}.</span> : null}
                      <span className="badge">{contractPayments.length} Zahlungen · {formatMoney(paymentTotal, contract.currency)}</span>
                      {linkedDocuments.map((document) => (
                        <a className="badge link-badge" href={document.url} key={document.id} target="_blank" rel="noreferrer">
                          {document.title}
                        </a>
                      ))}
                    </div>
                  </div>
                </summary>
                <div className="contract-body">
                  <ActionModal title="Vertrag bearbeiten" trigger="Bearbeiten" modalId={`contract-${contract.id}`}>
                    <AutosaveForm action={updateContract} className="form form-grid modal-form">
                      <input type="hidden" name="id" value={contract.id} />
                      <nav className="modal-section-tabs full-span" aria-label="Formularbereiche">
                        <a href={`#contract-${contract.id}-vertrag`}>Vertrag</a>
                        <a href={`#contract-${contract.id}-kosten`}>Kosten</a>
                        <a href={`#contract-${contract.id}-automatik`}>Automatik</a>
                        <a href={`#contract-${contract.id}-dokumente`}>Dokumente</a>
                      </nav>
                      <fieldset className="fieldset modal-form-section full-span" id={`contract-${contract.id}-vertrag`}>
                        <legend>Vertrag</legend>
                        <div className="form-grid">
                          <label>Anbieter<input name="provider" defaultValue={contract.provider} required /></label>
                          <label>Vertragsart<input name="contractType" defaultValue={contract.contractType} required /></label>
                          <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(contract.startDate)} required /></label>
                          <label>
                            Status
                            <select name="status" defaultValue={contract.status}>
                              <option value="ACTIVE">Aktiv</option>
                              <option value="DRAFT">Entwurf</option>
                              <option value="CANCELLED">Gekündigt</option>
                              <option value="EXPIRED">Ausgelaufen</option>
                            </select>
                          </label>
                          <ScopeSelect defaultValue={contract.scope} />
                        </div>
                      </fieldset>
                      <fieldset className="fieldset modal-form-section full-span" id={`contract-${contract.id}-kosten`}>
                        <legend>Kosten & Abbuchung</legend>
                        <div className="form-grid">
                          <label>Kosten in EUR<input name="cost" inputMode="decimal" defaultValue={formatEuroInput(contract.costCents)} required /></label>
                          <label>Preis gilt ab<input name="priceValidFrom" type="date" defaultValue={toDateInputValue(currentPricePhase?.validFrom ?? contract.startDate)} required /></label>
                          <input type="hidden" name="priceChangeMode" value="NEW_PHASE" />
                          <label>
                            Zahlungsrhythmus
                            <select name="billingInterval" defaultValue={contract.billingInterval}>
                              <option value="MONTHLY">Monatlich</option>
                              <option value="YEARLY">Jährlich</option>
                              <option value="QUARTERLY">Quartalsweise</option>
                              <option value="ONCE">Einmalig</option>
                              <option value="OTHER">Sonstiges</option>
                            </select>
                          </label>
                        </div>
                        <p className="muted">Die App legt daraus automatisch eine Preisphase an. Liegt das Datum in der Vergangenheit, bleiben bereits erzeugte Auto-Ausgaben unverändert, solange die Option nicht aktiv ist.</p>
                        <label className="checkbox-field contract-price-sync-toggle"><input name="updateGeneratedExpenses" type="checkbox" /> Bereits erzeugte Auto-Ausgaben ab &quot;Preis gilt ab&quot; anpassen</label>
                      </fieldset>
                      <fieldset className="fieldset modal-form-section full-span" id={`contract-${contract.id}-automatik`}>
                        <legend>Automatische Ausgabe</legend>
                        <div className="form-grid">
                          <label className="checkbox-field full-span"><input name="autoCreateExpenses" type="checkbox" defaultChecked={contract.autoCreateExpenses} /> Automatisch als Ausgabe eintragen</label>
                          <label>Einzugstag<input name="expensePaymentDay" type="number" min="1" max="31" defaultValue={contract.expensePaymentDay ?? new Date(contract.startDate).getDate()} /></label>
                          <SearchableSelect name="expenseCategoryId" label="Ausgaben-Kategorie" options={categories} defaultValue={contract.expenseCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
                          <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} defaultValue={contract.expenseLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
                        </div>
                      </fieldset>
                      <fieldset className="fieldset modal-form-section full-span">
                        <legend>Laufzeit & Kündigung</legend>
                        <div className="form-grid">
                          <label>Ende/Laufzeit bis<input name="endDate" type="date" defaultValue={toDateInputValue(contract.endDate)} /></label>
                          <label>Kündigung spätestens am<input name="cancellationDeadline" type="date" defaultValue={toAnnualCancellationInputValue(contract.cancellationDeadlineMonth, contract.cancellationDeadlineDay)} /></label>
                          <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" defaultValue={contract.cancellationNoticeDays ?? ""} /></label>
                          <input type="hidden" name="renewalAnchorDay" value={contract.renewalAnchorDay ?? ""} />
                          <label className="checkbox-field"><input name="autoRenewal" type="checkbox" defaultChecked={contract.autoRenewal} /> Verlängert sich automatisch</label>
                          <label>
                            Verlängerungsrhythmus
                            <select name="renewalInterval" defaultValue={contract.renewalInterval}>
                              <option value="MONTHLY">Monatlich</option>
                              <option value="QUARTERLY">Quartalsweise</option>
                              <option value="YEARLY">Jährlich</option>
                            </select>
                          </label>
                        </div>
                        <p className="muted">Bei automatischer Verlängerung ist &quot;Ende/Laufzeit bis&quot; der nächste Vertrags- oder Verlängerungstermin. Die App rollt die Kündigungsfrist danach automatisch weiter.</p>
                      </fieldset>
                      <label className="full-span">Notizen<textarea name="description" defaultValue={contract.description ?? ""} /></label>
                      <div className="full-span price-history">
                        <strong>Preisentwicklung</strong>
                        {contract.pricePhases.map((phase) => (
                          <span className="badge" key={phase.id}>
                            {formatMoney(phase.amountCents, phase.currency)} · {billingLabels[phase.billingInterval]} · ab {formatDate(phase.validFrom)}{phase.validTo ? ` bis ${formatDate(phase.validTo)}` : ""}
                          </span>
                        ))}
                      </div>
                      <details className="optional-section full-span" id={`contract-${contract.id}-dokumente`} open={Boolean(primaryDocument)}>
                        <summary>Beleg / Drive-Link hinzufügen</summary>
                        <input type="hidden" name="documentId" value={primaryDocument?.id ?? ""} />
                        <div className="form-grid">
                          <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.title ?? ""} placeholder="Vertrag, Rechnung, Nachweis ..." /></label>
                          <label>Drive-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
                        </div>
                      </details>
                      <button className="button full-span autosave-submit" type="submit">Speichern</button>
                    </AutosaveForm>
                  </ActionModal>
                  <ContractPayments
                    payments={contractPayments.map((payment) => ({
                      id: payment.id,
                      date: payment.date.toISOString(),
                      description: payment.description,
                      amountCents: payment.amountCents,
                      currency: payment.currency
                    }))}
                    totalCents={paymentTotal}
                    currency={contract.currency}
                  />
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </>
  );
}

function matchesContract(contract: ContractLike, query: string) {
  return [
    contract.provider,
    contract.contractType,
    contract.description,
    billingLabels[contract.billingInterval],
    statusLabels[contract.status],
    contract.owner.name
  ].some((value) => normalizeSearch(value).includes(query));
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatEuroInput(amountCents: number) {
  if (amountCents === 0) return "";
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

function getContractStatusFilter(value: unknown): ContractStatusFilter | null {
  if (value === "ACTIVE" || value === "DRAFT" || value === "CANCELLED" || value === "EXPIRED" || value === "ENDED") return value;
  return null;
}

function buildContractsHref(params: { q?: string | null; status?: ContractStatusFilter | null }) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return query ? `/vertraege?${query}` : "/vertraege";
}

const billingLabels = {
  MONTHLY: "Monatlich",
  YEARLY: "Jährlich",
  QUARTERLY: "Quartalsweise",
  ONCE: "Einmalig",
  OTHER: "Sonstiges"
};

const renewalLabels = {
  MONTHLY: "monatlich",
  YEARLY: "jährlich",
  QUARTERLY: "quartalsweise",
  ONCE: "einmalig",
  OTHER: "individuell"
};

const statusLabels = {
  ACTIVE: "Aktiv",
  CANCELLED: "Gekündigt",
  EXPIRED: "Ausgelaufen",
  DRAFT: "Entwurf"
};

type ContractLike = Awaited<ReturnType<typeof getVisibleContractsWithExpenseDetails>>[number];
type ContractStatusFilter = ContractLike["status"] | "ENDED";
