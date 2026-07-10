import { createLocalDocumentReference, deleteDocumentReference, updateDocumentReference } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { listDocumentDirectory, type DocumentFileEntry } from "@/lib/document-files";
import { formatDate } from "@/lib/format";
import { getVisibleDocumentRoots, getVisibleDocuments } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { DocumentFilePreview } from "@/components/document-file-preview";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

type DocumentsPageProps = {
  searchParams: Promise<{ q?: string; tab?: string; root?: string; path?: string }>;
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const query = normalizeSearch(params.q);
  const tab = getDocumentTab(params.tab);
  const [documents, roots] = await Promise.all([
    getVisibleDocuments(session.family.id, session.user.id),
    getVisibleDocumentRoots(session.family.id, session.user.id, session.role)
  ]);
  const selectedRoot = roots.find((root) => root.id === params.root) ?? roots[0] ?? null;
  const selectedPath = params.path ?? "";
  const explorerEntries = selectedRoot ? await safeListEntries(selectedRoot.basePath, selectedPath) : [];
  const visibleDocuments = filterDocuments(documents, query, tab);

  return (
    <>
      <PageHeader title="Dokumente" description="Links und lokale NAS-Dateien an einem Ort." />
      <form className="search-bar document-search">
        <label>
          <span>Dokumente durchsuchen</span>
          <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Titel, Datei, Beschreibung, Bezug ..." />
        </label>
        <button className="button secondary" type="submit">Suchen</button>
        {query ? <a className="button secondary" href="/dokumente">Zurücksetzen</a> : null}
      </form>

      <nav className="document-tabs" aria-label="Dokumentfilter">
        {documentTabs.map((item) => (
          <a className={tab === item.id ? "active" : ""} href={documentHref(params, { tab: item.id })} key={item.id}>{item.label}</a>
        ))}
      </nav>

      <section className="panel document-panel">
        <div className="section-head">
          <div>
            <h2 className="section-title">Gespeicherte Verweise</h2>
            <p className="muted">{visibleDocuments.length} Einträge</p>
          </div>
        </div>
        <div className="document-list">
          {visibleDocuments.length === 0 ? <EmptyState>{query ? "Keine passenden Dokumente gefunden." : "Noch keine Dokumentverweise gespeichert."}</EmptyState> : null}
          {visibleDocuments.map((document) => (
            <article className="document-row" key={document.id}>
              <div className="document-icon" aria-hidden="true">{document.referenceType === "LOCAL_FILE" ? fileIcon(document.mimeType) : "LINK"}</div>
              <div className="document-copy">
                <strong>{document.title}</strong>
                <span className="muted">
                  {document.referenceType === "LOCAL_FILE"
                    ? [document.documentRoot?.name, document.relativePath].filter(Boolean).join(" / ")
                    : document.url}
                </span>
                <div className="badge-row">
                  <span className="badge">{document.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                  <span className="badge">{document.referenceType === "LOCAL_FILE" ? "Datei" : "Link"}</span>
                  <span className="badge">{linkedEntityLabels[document.linkedEntityType]}</span>
                  <span className="badge">{document.owner.name} · {formatDate(document.createdAt)}</span>
                </div>
                {document.description ? <p>{document.description}</p> : null}
              </div>
              <details className="document-row-actions">
                <summary>Aktionen</summary>
                <div className="entry-actions document-actions">
                {document.referenceType === "LOCAL_FILE" ? (
                  <>
                    <DocumentFilePreview
                      href={`/api/documents/file?id=${encodeURIComponent(document.id)}`}
                      downloadHref={`/api/documents/file?id=${encodeURIComponent(document.id)}&download=1`}
                      fileName={document.fileName ?? document.title}
                      mimeType={document.mimeType}
                      disabled={!isPreviewableMimeType(document.mimeType)}
                    />
                    <a className="button secondary" href={`/api/documents/file?id=${encodeURIComponent(document.id)}&download=1`}>Download</a>
                  </>
                ) : (
                  <a className="button" href={document.url} target="_blank" rel="noreferrer">Öffnen</a>
                )}
                <ActionModal title="Dokument bearbeiten" trigger="Bearbeiten" modalId={`document-${document.id}`}>
                  <AutosaveForm action={updateDocumentReference} className="form form-grid modal-form">
                    <input type="hidden" name="id" value={document.id} />
                    <label>Titel<input name="title" defaultValue={document.title} required /></label>
                    {document.referenceType === "LOCAL_FILE" ? (
                      <label>Datei<input value={document.relativePath ?? ""} readOnly /></label>
                    ) : (
                      <label>HTTPS-Link<input name="url" type="url" defaultValue={document.url} required /></label>
                    )}
                    <LinkedEntityFields defaultType={document.linkedEntityType} defaultId={document.linkedEntityId ?? ""} />
                    <ScopeSelect defaultValue={document.scope} />
                    <label className="full-span">Beschreibung<textarea name="description" defaultValue={document.description ?? ""} /></label>
                    <div className="modal-submit-row modal-footer"><button className="button" type="submit">Speichern</button></div>
                  </AutosaveForm>
                </ActionModal>
                <form action={deleteDocumentReference}>
                  <input type="hidden" name="id" value={document.id} />
                  <button className="button secondary" type="submit">Löschen</button>
                </form>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="panel document-panel spacing-top" id="datei-explorer">
        <div className="section-head">
          <div>
            <h2 className="section-title">Dateien durchsuchen</h2>
            <p className="muted">Lokale Dateien aus freigegebenen Dokumentbereichen.</p>
          </div>
        </div>
        {roots.length === 0 ? (
          <EmptyState>Noch kein Dokumentbereich freigegeben. Admins verwalten Dokumentbereiche in den Einstellungen.</EmptyState>
        ) : (
          <>
            <div className="document-explorer-toolbar">
              <div className="document-root-switcher" aria-label="Dokumentbereich">
                <span>Bereich</span>
                <div>
                  {roots.map((root) => (
                    <a className={selectedRoot?.id === root.id ? "active" : ""} href={documentHref(params, { root: root.id, path: "" })} key={root.id}>{root.name}</a>
                  ))}
                </div>
              </div>
              {selectedRoot ? <Breadcrumbs params={params} rootId={selectedRoot.id} rootName={selectedRoot.name} path={selectedPath} /> : null}
              <span className="document-explorer-count">{explorerEntries.length} Einträge</span>
            </div>
            <div className="document-file-list">
              {explorerEntries.length === 0 ? (
                <EmptyState>
                  Keine Dateien gefunden. Lege Dateien in den freigegebenen Ordner und lade die Seite neu.
                </EmptyState>
              ) : null}
              {explorerEntries.map((entry) => (
                <FileEntryRow entry={entry} params={params} rootId={selectedRoot?.id ?? ""} key={entry.relativePath} />
              ))}
            </div>
          </>
        )}
      </section>

    </>
  );
}

function FileEntryRow({ entry, params, rootId }: { entry: DocumentFileEntry; params: Awaited<DocumentsPageProps["searchParams"]>; rootId: string }) {
  if (entry.kind === "directory") {
    return (
      <a className="document-file-row" href={documentHref(params, { root: rootId, path: entry.relativePath })}>
        <span className="document-icon" aria-hidden="true">DIR</span>
        <span><strong>{entry.name}</strong><small>Ordner</small></span>
      </a>
    );
  }

  return (
    <details className="document-file-disclosure">
      <summary className="document-file-row">
        <span className="document-icon" aria-hidden="true">{fileIcon(entry.mimeType)}</span>
        <span><strong>{entry.name}</strong><small>{formatFileSize(entry.fileSize)} · {formatDate(entry.updatedAt)}</small></span>
      </summary>
      <div className="document-file-options">
        <DocumentFilePreview
          href={`/api/documents/file?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entry.relativePath)}`}
          downloadHref={`/api/documents/file?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entry.relativePath)}&download=1`}
          fileName={entry.name}
          mimeType={entry.mimeType}
          disabled={!entry.previewable}
        />
        <a className="button secondary" href={`/api/documents/file?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entry.relativePath)}&download=1`}>Download</a>
        <ActionModal title="Datei als Verweis speichern" trigger="Speichern" modalId={`file-${rootId}-${entry.relativePath.replace(/[^a-z0-9]/gi, "-")}`}>
          <form action={createLocalDocumentReference} className="form form-grid modal-form">
            <input type="hidden" name="documentRootId" value={rootId} />
            <input type="hidden" name="relativePath" value={entry.relativePath} />
            <label>Titel<input name="title" defaultValue={entry.name} required /></label>
            <label>Datei<input value={entry.relativePath} readOnly /></label>
            <LinkedEntityFields />
            <ScopeSelect />
            <label className="full-span">Beschreibung<textarea name="description" /></label>
            <div className="modal-submit-row modal-footer"><button className="button" type="submit">Verweis speichern</button></div>
          </form>
        </ActionModal>
      </div>
    </details>
  );
}

function LinkedEntityFields({ defaultType = "GENERAL", defaultId = "" }: { defaultType?: keyof typeof linkedEntityLabels; defaultId?: string }) {
  return (
    <>
      <label>
        Bezug
        <select name="linkedEntityType" defaultValue={defaultType}>
          <option value="GENERAL">Allgemein</option>
          <option value="EXPENSE">Ausgabe</option>
          <option value="TASK">Aufgabe</option>
          <option value="CONTRACT">Vertrag</option>
        </select>
      </label>
      <details className="optional-section document-advanced-link-id">
        <summary>Erweitert</summary>
        <label>Bezugs-ID<input name="linkedEntityId" defaultValue={defaultId} placeholder="Optional" /></label>
      </details>
    </>
  );
}

function Breadcrumbs({ params, rootId, rootName, path }: { params: Awaited<DocumentsPageProps["searchParams"]>; rootId: string; rootName: string; path: string }) {
  const parts = path.split("/").filter(Boolean);
  return (
    <nav className="document-path-bar" aria-label="Dateipfad">
      <a href={documentHref(params, { root: rootId, path: "" })}>{rootName}</a>
      {parts.map((part, index) => {
        const breadcrumbPath = parts.slice(0, index + 1).join("/");
        return (
          <span className="document-path-part" key={breadcrumbPath}>
            <span aria-hidden="true">/</span>
            <a href={documentHref(params, { root: rootId, path: breadcrumbPath })}>{part}</a>
          </span>
        );
      })}
    </nav>
  );
}

async function safeListEntries(rootPath: string, relativePath: string) {
  try {
    return await listDocumentDirectory(rootPath, relativePath);
  } catch {
    return [];
  }
}

function filterDocuments(documents: Awaited<ReturnType<typeof getVisibleDocuments>>, query: string, tab: DocumentTab) {
  return documents
    .filter((document) => {
      if (tab === "files") return document.referenceType === "LOCAL_FILE";
      if (tab === "links") return document.referenceType !== "LOCAL_FILE";
      if (tab === "linked") return document.linkedEntityType !== "GENERAL";
      return true;
    })
    .filter((document) => !query || [
      document.title,
      document.description,
      document.url,
      document.fileName,
      document.relativePath,
      document.documentRoot?.name,
      document.owner.name,
      document.linkedEntityType
    ].some((value) => normalizeSearch(value).includes(query)));
}

function documentHref(params: Awaited<DocumentsPageProps["searchParams"]>, updates: Partial<Awaited<DocumentsPageProps["searchParams"]>>) {
  const search = new URLSearchParams();
  const next = { ...params, ...updates };
  for (const key of ["q", "tab", "root", "path"] as const) {
    const value = next[key];
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/dokumente?${query}` : "/dokumente";
}

function getDocumentTab(value: unknown): DocumentTab {
  return documentTabs.some((tab) => tab.id === value) ? value as DocumentTab : "all";
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function fileIcon(mimeType: string | null | undefined) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.startsWith("image/")) return "IMG";
  if (mimeType?.startsWith("text/")) return "TXT";
  return "DOC";
}

function isPreviewableMimeType(mimeType: string | null | undefined) {
  return mimeType === "application/pdf"
    || mimeType === "text/plain"
    || mimeType === "text/csv"
    || Boolean(mimeType?.startsWith("image/"));
}

const documentTabs = [
  { id: "all", label: "Alle" },
  { id: "files", label: "Dateien" },
  { id: "links", label: "Links" },
  { id: "linked", label: "Verknüpft" }
] as const;

type DocumentTab = typeof documentTabs[number]["id"];

const linkedEntityLabels = {
  EXPENSE: "Ausgabe",
  TASK: "Aufgabe",
  CONTRACT: "Vertrag",
  GENERAL: "Allgemein"
};
