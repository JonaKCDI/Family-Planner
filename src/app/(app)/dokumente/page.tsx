import { deleteDocumentReference, updateDocumentReference } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getVisibleDocuments } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

type DocumentsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const query = normalizeSearch(params.q);
  const documents = await getVisibleDocuments(session.family.id, session.user.id);
  const visibleDocuments = query
    ? documents.filter((document) => [
      document.title,
      document.description,
      document.url,
      document.owner.name,
      document.linkedEntityType
    ].some((value) => normalizeSearch(value).includes(query)))
    : documents;

  return (
    <>
      <PageHeader title="Dokumente" />
      <form className="search-bar">
        <label>
          <span>Dokumente durchsuchen</span>
          <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Titel, Link, Beschreibung ..." />
        </label>
        <button className="button secondary" type="submit">Suchen</button>
        {query ? <a className="button secondary" href="/dokumente">Zurücksetzen</a> : null}
      </form>
      <section className="panel">
        <h2 className="section-title">Gespeicherte Verweise</h2>
        <div className="list">
          {visibleDocuments.length === 0 ? <EmptyState>{query ? "Keine passenden Dokumente gefunden." : "Noch keine Dokumentverweise gespeichert."}</EmptyState> : null}
          {visibleDocuments.map((document) => (
            <article className="card" key={document.id}>
              <div className="row">
                <div>
                  <strong>{document.title}</strong>
                  <span className="muted">{document.owner.name} · {formatDate(document.createdAt)}</span>
                  {document.description ? <p>{document.description}</p> : null}
                  <div className="badge-row">
                    <span className="badge">{document.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                    <span className="badge">{linkedEntityLabels[document.linkedEntityType]}</span>
                  </div>
                </div>
                <div className="entry-actions">
                  <a className="button secondary" href={document.url} target="_blank" rel="noreferrer">Öffnen</a>
                  <ActionModal title="Dokument bearbeiten" trigger="Bearbeiten">
                    <form action={updateDocumentReference} className="form form-grid modal-form">
                      <input type="hidden" name="id" value={document.id} />
                      <label>Titel<input name="title" defaultValue={document.title} required /></label>
                      <label>Drive-Link<input name="url" type="url" defaultValue={document.url} required /></label>
                      <label>
                        Bezug
                        <select name="linkedEntityType" defaultValue={document.linkedEntityType}>
                          <option value="GENERAL">Allgemein</option>
                          <option value="EXPENSE">Ausgabe</option>
                          <option value="TASK">Aufgabe</option>
                          <option value="CONTRACT">Vertrag</option>
                        </select>
                      </label>
                      <label>Bezugs-ID optional<input name="linkedEntityId" defaultValue={document.linkedEntityId ?? ""} /></label>
                      <ScopeSelect defaultValue={document.scope} />
                      <label className="full-span">Beschreibung<textarea name="description" defaultValue={document.description ?? ""} /></label>
                      <button className="button full-span" type="submit">Änderungen speichern</button>
                    </form>
                  </ActionModal>
                  <form action={deleteDocumentReference}>
                    <input type="hidden" name="id" value={document.id} />
                    <button className="button secondary" type="submit">Löschen</button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

const linkedEntityLabels = {
  EXPENSE: "Ausgabe",
  TASK: "Aufgabe",
  CONTRACT: "Vertrag",
  GENERAL: "Allgemein"
};
