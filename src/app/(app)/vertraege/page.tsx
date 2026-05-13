import { updateContract } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { getDocumentsForLinkedEntities, getVisibleContracts } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

type ContractsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const query = normalizeSearch(params.q);
  const contracts = await getVisibleContracts(session.family.id, session.user.id);
  const visibleContracts = query ? contracts.filter((contract) => matchesContract(contract, query)) : contracts;
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
  const activeCosts = visibleContracts
    .filter((contract) => contract.status === "ACTIVE")
    .reduce((sum, contract) => sum + contract.costCents, 0);

  return (
    <>
      <PageHeader title="Verträge" description="Überblick über Versicherungen, Abos, Energie, Internet und Fristen." />
      <form className="search-bar">
        <label>
          <span>Verträge durchsuchen</span>
          <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Anbieter, Art, Notiz, Status ..." />
        </label>
        <button className="button secondary" type="submit">Suchen</button>
        {query ? <a className="button secondary" href="/vertraege">Zurücksetzen</a> : null}
      </form>
      <section className="stats">
        <div className="stat"><span>Aktive Kosten</span><strong>{formatMoney(activeCosts)}</strong></div>
        <div className="stat"><span>Verträge</span><strong>{visibleContracts.length}</strong></div>
        <div className="stat"><span>Aktiv</span><strong>{visibleContracts.filter((contract) => contract.status === "ACTIVE").length}</strong></div>
        <div className="stat"><span>Nächste Frist</span><strong>{formatDate(visibleContracts.find((contract) => contract.nextCancellationDate)?.nextCancellationDate)}</strong></div>
      </section>
      <section className="panel">
        <h2 className="section-title">Vertragsübersicht</h2>
        <div className="list">
          {visibleContracts.length === 0 ? <EmptyState>{query ? "Keine passenden Verträge gefunden." : "Noch keine Verträge erfasst."}</EmptyState> : null}
          {visibleContracts.map((contract) => {
            const linkedDocuments = documentsByContract[contract.id] ?? [];
            const primaryDocument = linkedDocuments[0];
            return (
              <article className="card" key={contract.id}>
                <div className="row">
                  <div>
                    <strong>{contract.provider}</strong>
                    <span className="muted">{contract.contractType} · {billingLabels[contract.billingInterval]} · {contract.owner.name}</span>
                    <p>{formatMoney(contract.costCents, contract.currency)} · Kündigungsfrist: {formatDate(contract.nextCancellationDate)}</p>
                    <div className="badge-row">
                      <span className="badge">{statusLabels[contract.status]}</span>
                      <span className="badge">{contract.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                      {linkedDocuments.map((document) => (
                        <a className="badge link-badge" href={document.url} key={document.id} target="_blank" rel="noreferrer">
                          {document.title}
                        </a>
                      ))}
                    </div>
                  </div>
                  <ActionModal title="Vertrag bearbeiten" trigger="Bearbeiten">
                    <form action={updateContract} className="form form-grid modal-form">
                      <input type="hidden" name="id" value={contract.id} />
                      <label>Anbieter<input name="provider" defaultValue={contract.provider} required /></label>
                      <label>Vertragsart<input name="contractType" defaultValue={contract.contractType} required /></label>
                      <label>Kosten in EUR<input name="cost" inputMode="decimal" defaultValue={formatEuroInput(contract.costCents)} required /></label>
                      <label>
                        Intervall
                        <select name="billingInterval" defaultValue={contract.billingInterval}>
                          <option value="MONTHLY">Monatlich</option>
                          <option value="YEARLY">Jährlich</option>
                          <option value="QUARTERLY">Quartalsweise</option>
                          <option value="ONCE">Einmalig</option>
                          <option value="OTHER">Sonstiges</option>
                        </select>
                      </label>
                      <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(contract.startDate)} required /></label>
                      <label>Ende/Laufzeit bis<input name="endDate" type="date" defaultValue={toDateInputValue(contract.endDate)} /></label>
                      <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" defaultValue={contract.cancellationNoticeDays ?? ""} /></label>
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
                      <label className="full-span">Notizen<textarea name="description" defaultValue={contract.description ?? ""} /></label>
                      <fieldset className="fieldset full-span">
                        <legend>Drive-Link optional verknüpfen</legend>
                        <input type="hidden" name="documentId" value={primaryDocument?.id ?? ""} />
                        <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.title ?? ""} placeholder="Vertrag, Rechnung, Nachweis ..." /></label>
                        <label>Drive-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
                      </fieldset>
                      <button className="button full-span" type="submit">Änderungen speichern</button>
                    </form>
                  </ActionModal>
                </div>
              </article>
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

const billingLabels = {
  MONTHLY: "Monatlich",
  YEARLY: "Jährlich",
  QUARTERLY: "Quartalsweise",
  ONCE: "Einmalig",
  OTHER: "Sonstiges"
};

const statusLabels = {
  ACTIVE: "Aktiv",
  CANCELLED: "Gekündigt",
  EXPIRED: "Ausgelaufen",
  DRAFT: "Entwurf"
};

type ContractLike = Awaited<ReturnType<typeof getVisibleContracts>>[number];
