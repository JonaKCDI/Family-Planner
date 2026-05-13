import { createContract } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { getDocumentsForLinkedEntities, getVisibleContracts } from "@/lib/queries";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

export default async function ContractsPage() {
  const session = await requireSession();
  const contracts = await getVisibleContracts(session.family.id, session.user.id);
  const documents = await getDocumentsForLinkedEntities(
    session.family.id,
    session.user.id,
    "CONTRACT",
    contracts.map((contract) => contract.id)
  );
  const documentsByContract = documents.reduce<Record<string, typeof documents>>((groups, document) => {
    const key = document.linkedEntityId ?? "";
    groups[key] = [...(groups[key] ?? []), document];
    return groups;
  }, {});
  const activeCosts = contracts
    .filter((contract) => contract.status === "ACTIVE")
    .reduce((sum, contract) => sum + contract.costCents, 0);

  return (
    <>
      <PageHeader title="Verträge" description="Überblick über Versicherungen, Abos, Energie, Internet und Fristen." />
      <section className="stats">
        <div className="stat"><span>Aktive Kosten</span><strong>{formatMoney(activeCosts)}</strong></div>
        <div className="stat"><span>Verträge</span><strong>{contracts.length}</strong></div>
        <div className="stat"><span>Aktiv</span><strong>{contracts.filter((contract) => contract.status === "ACTIVE").length}</strong></div>
        <div className="stat"><span>Nächste Frist</span><strong>{formatDate(contracts.find((contract) => contract.nextCancellationDate)?.nextCancellationDate)}</strong></div>
      </section>
      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Vertrag erfassen</h2>
          <form action={createContract} className="form">
            <label>Anbieter<input name="provider" required /></label>
            <label>Vertragsart<input name="contractType" placeholder="Mobilfunk, Versicherung, Abo ..." required /></label>
            <label>Kosten in EUR<input name="cost" inputMode="decimal" placeholder="29,99" required /></label>
            <label>
              Intervall
              <select name="billingInterval" defaultValue="MONTHLY">
                <option value="MONTHLY">Monatlich</option>
                <option value="YEARLY">Jährlich</option>
                <option value="QUARTERLY">Quartalsweise</option>
                <option value="ONCE">Einmalig</option>
                <option value="OTHER">Sonstiges</option>
              </select>
            </label>
            <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(new Date())} required /></label>
            <label>Ende/Laufzeit bis<input name="endDate" type="date" /></label>
            <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" /></label>
            <label>
              Status
              <select name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Aktiv</option>
                <option value="DRAFT">Entwurf</option>
                <option value="CANCELLED">Gekündigt</option>
                <option value="EXPIRED">Ausgelaufen</option>
              </select>
            </label>
            <label>Notizen<textarea name="description" /></label>
            <ScopeSelect />
            <fieldset className="fieldset">
              <legend>Dokument optional verknüpfen</legend>
              <label>Dokumenttitel<input name="documentTitle" placeholder="Vertrag, Rechnung, Police ..." /></label>
              <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://..." /></label>
              <label>
                Linktyp
                <select name="documentReferenceType" defaultValue="SYNOLOGY_HTTPS">
                  <option value="SYNOLOGY_HTTPS">Synology HTTPS</option>
                  <option value="WEBDAV_HTTPS">WebDAV HTTPS</option>
                  <option value="EXTERNAL_URL">Externer Link</option>
                </select>
              </label>
            </fieldset>
            <button className="button" type="submit">Speichern</button>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">Vertragsübersicht</h2>
          <div className="list">
            {contracts.length === 0 ? <EmptyState>Noch keine Verträge erfasst.</EmptyState> : null}
            {contracts.map((contract) => {
              const linkedDocuments = documentsByContract[contract.id] ?? [];
              return (
                <article className="card" key={contract.id}>
                  <div className="row">
                    <div>
                      <strong>{contract.provider}</strong>
                      <span className="muted">{contract.contractType} · {contract.billingInterval} · {contract.owner.name}</span>
                      <p>{formatMoney(contract.costCents, contract.currency)} · Kündigungsfrist: {formatDate(contract.nextCancellationDate)}</p>
                      <div className="badge-row">
                        {linkedDocuments.map((document) => (
                          <a className="badge link-badge" href={document.url} key={document.id} target="_blank" rel="noreferrer">
                            {document.title}
                          </a>
                        ))}
                      </div>
                    </div>
                    <span className="badge">{contract.status}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
