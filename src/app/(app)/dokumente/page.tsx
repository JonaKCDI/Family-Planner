import { createDocumentReference } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getVisibleDocuments } from "@/lib/queries";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

export default async function DocumentsPage() {
  const session = await requireSession();
  const documents = await getVisibleDocuments(session.family.id, session.user.id);

  return (
    <>
      <PageHeader title="Dokumente" description="HTTPS-Verweise auf Synology oder externe Quellen. Dateien bleiben ausserhalb der App." />
      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Dokumentverweis speichern</h2>
          <form action={createDocumentReference} className="form">
            <label>Titel<input name="title" required /></label>
            <label>HTTPS-Link<input name="url" type="url" placeholder="https://..." required /></label>
            <label>
              Typ
              <select name="referenceType" defaultValue="SYNOLOGY_HTTPS">
                <option value="SYNOLOGY_HTTPS">Synology HTTPS</option>
                <option value="WEBDAV_HTTPS">WebDAV HTTPS</option>
                <option value="EXTERNAL_URL">Externer Link</option>
              </select>
            </label>
            <label>
              Bezug
              <select name="linkedEntityType" defaultValue="GENERAL">
                <option value="GENERAL">Allgemein</option>
                <option value="EXPENSE">Ausgabe</option>
                <option value="TASK">Aufgabe</option>
                <option value="CONTRACT">Vertrag</option>
                <option value="CALENDAR_EVENT">Kalendertermin</option>
              </select>
            </label>
            <label>Bezugs-ID optional<input name="linkedEntityId" /></label>
            <label>Beschreibung<textarea name="description" /></label>
            <ScopeSelect />
            <button className="button" type="submit">Speichern</button>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">Gespeicherte Verweise</h2>
          <div className="list">
            {documents.length === 0 ? <EmptyState>Noch keine Dokumentverweise gespeichert.</EmptyState> : null}
            {documents.map((document) => (
              <article className="card" key={document.id}>
                <div className="row">
                  <div>
                    <strong>{document.title}</strong>
                    <span className="muted">{document.referenceType} · {document.owner.name} · {formatDate(document.createdAt)}</span>
                    {document.description ? <p>{document.description}</p> : null}
                    <span className="badge">{document.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                  </div>
                  <a className="button secondary" href={document.url} target="_blank" rel="noreferrer">Oeffnen</a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
