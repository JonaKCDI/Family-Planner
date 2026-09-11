import { createLocalDocumentReference, deleteDocumentReference, updateDocumentReference } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { listDocumentDirectory, type DocumentFileEntry } from "@/lib/document-files";
import { formatDate } from "@/lib/format";
import { getVisibleDocumentRoots, getVisibleDocuments } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DocumentFilePreview } from "@/components/document-file-preview";
import { DocumentSummaryStrip, DocumentToolbar, type DocumentToolbarParams } from "@/components/document-toolbar";
import { DocumentRootSelect } from "@/components/document-root-select";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";
import { CalendarDays, Download, ExternalLink, FileText, Folder, HardDrive, Link as LinkIcon, Lock, Pencil, Save, Tag, UserRound } from "lucide-react";

type DocumentsPageProps = {
  searchParams: Promise<DocumentPageParams>;
};

type DocumentPageParams = {
  q?: string;
  tab?: string;
  root?: string;
  path?: string;
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
  const searchedDocuments = filterDocumentsBySearch(documents, query);
  const visibleDocuments = filterDocumentsByTab(searchedDocuments, tab);
  const activeFilterCount = tab === "all" ? 0 : 1;
  const normalizedParams = normalizeDocumentParams(params);

  return (
    <div className="document-page">
      <div className="document-page-head">
        <PageHeader title="Dokumente" />
        <DocumentToolbar params={normalizedParams} activeFilterCount={activeFilterCount} />
      </div>

      {activeFilterCount > 0 || query ? (
        <div className="active-filter-row document-active-filters" aria-label="Aktive Dokumentfilter">
          {query ? <a className="filter-chip" href={documentHref(params, { q: undefined })}><span>Suche: {params.q}</span><strong aria-hidden="true">×</strong></a> : null}
          {tab !== "all" ? <a className="filter-chip" href={documentHref(params, { tab: undefined })}><span>{documentTabLabels[tab]}</span><strong aria-hidden="true">×</strong></a> : null}
          <a className="filter-chip clear-all" href="/dokumente">Alle löschen</a>
        </div>
      ) : null}

      <DocumentSummaryStrip
        key={tab}
        tab={tab}
        items={[
          { count: searchedDocuments.length, href: documentHref(params, { tab: undefined }), label: "alle", tab: "all" },
          { count: filterDocumentsByTab(searchedDocuments, "files").length, href: documentHref(params, { tab: "files" }), label: "Dateien", tab: "files" },
          { count: filterDocumentsByTab(searchedDocuments, "links").length, href: documentHref(params, { tab: "links" }), label: "Links", tab: "links" },
          { count: filterDocumentsByTab(searchedDocuments, "linked").length, href: documentHref(params, { tab: "linked" }), label: "verknüpft", tab: "linked" }
        ]}
      />

      <section className="document-list-section spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">Gespeicherte Verweise</h2>
            <p className="muted">{visibleDocuments.length} Einträge</p>
          </div>
        </div>
        <div className="document-priority-list">
          {visibleDocuments.length === 0 ? <EmptyState>{query ? "Keine passenden Dokumente gefunden." : "Noch keine Dokumentverweise gespeichert."}</EmptyState> : null}
          {visibleDocuments.map((document) => <DocumentReferenceRow document={document} key={document.id} />)}
        </div>
      </section>

      <section className="document-list-section spacing-top" id="datei-explorer">
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
                <DocumentRootSelect
                  selectedId={selectedRoot?.id ?? ""}
                  options={roots.map((root) => ({ id: root.id, name: root.name, href: documentHref(params, { root: root.id, path: "" }) }))}
                />
              </div>
              {selectedRoot ? <Breadcrumbs params={params} rootId={selectedRoot.id} rootName={selectedRoot.name} path={selectedPath} /> : null}
            </div>
            <div className="document-priority-list document-file-list">
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
    </div>
  );
}

function DocumentReferenceRow({ document }: { document: DocumentLike }) {
  const localFile = document.referenceType === "LOCAL_FILE";
  const pathLabel = localFile
    ? [document.documentRoot?.name, document.relativePath].filter(Boolean).join(" / ")
    : document.url;

  return (
    <ActionModal
      title="Dokumentdetails"
      trigger={<DocumentRowContent iconLabel={localFile ? fileIcon(document.mimeType) : "LINK"} title={document.title} subtitle={pathLabel} sideTop={formatDate(document.createdAt)} sideBottom={localFile ? "Datei" : "Link"} />}
      triggerClassName="document-row-trigger"
      modalId={`document-reference-${document.id}`}
    >
      <div className="document-detail-sheet">
        <div className="document-detail-head">
          <span className="document-detail-icon" aria-hidden="true">{localFile ? <FileText size={19} /> : <LinkIcon size={19} />}</span>
          <div className="task-detail-title-block">
            <h3>{document.title}</h3>
            <span>{localFile ? "Lokale Datei" : "HTTPS-Link"}</span>
          </div>
          <DocumentEditModal document={document} />
        </div>
        <dl className="task-detail-meta document-detail-meta">
          <div><UserRound size={18} aria-hidden="true" /><dt>Besitzer</dt><dd>{document.owner.name}</dd></div>
          <div><CalendarDays size={18} aria-hidden="true" /><dt>Erstellt</dt><dd>{formatDate(document.createdAt)}</dd></div>
          <div><Lock size={18} aria-hidden="true" /><dt>Sichtbarkeit</dt><dd>{document.scope === "FAMILY" ? "Familie" : "Privat"}</dd></div>
          <div><Tag size={18} aria-hidden="true" /><dt>Bezug</dt><dd>{linkedEntityLabels[document.linkedEntityType]}</dd></div>
          {localFile ? <div><HardDrive size={18} aria-hidden="true" /><dt>Bereich</dt><dd>{document.documentRoot?.name ?? "Dokumentbereich"}</dd></div> : null}
        </dl>
        <div className="task-detail-note document-detail-path">
          <span>{localFile ? "Datei" : "Link"}</span>
          {localFile ? <p>{document.relativePath}</p> : <a href={document.url} target="_blank" rel="noreferrer">{document.url}</a>}
        </div>
        {document.description ? <div className="task-detail-note"><span>Beschreibung</span><p>{document.description}</p></div> : null}
        <div className="document-detail-actions">
          {localFile ? (
            <>
              <DocumentFilePreview
                href={`/api/documents/file?id=${encodeURIComponent(document.id)}`}
                downloadHref={`/api/documents/file?id=${encodeURIComponent(document.id)}&download=1`}
                fileName={document.fileName ?? document.title}
                mimeType={document.mimeType}
                disabled={!isPreviewableMimeType(document.mimeType)}
              />
              <a className="button secondary" href={`/api/documents/file?id=${encodeURIComponent(document.id)}&download=1`}>
                <Download size={16} aria-hidden="true" />
                <span>Download</span>
              </a>
            </>
          ) : (
            <a className="button" href={document.url} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              <span>Öffnen</span>
            </a>
          )}
          <form action={deleteDocumentReference}>
            <input type="hidden" name="id" value={document.id} />
            <ConfirmSubmitButton title="Dokument löschen?" message="Die Referenz wird entfernt. Die Datei selbst bleibt auf dem NAS erhalten.">Löschen</ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </ActionModal>
  );
}

function FileEntryRow({ entry, params, rootId }: { entry: DocumentFileEntry; params: DocumentPageParams; rootId: string }) {
  if (entry.kind === "directory") {
    return (
      <a className="document-row-trigger document-directory-trigger" href={documentHref(params, { root: rootId, path: entry.relativePath })}>
        <DocumentRowContent iconLabel="DIR" title={entry.name} subtitle="Ordner" sideTop="Öffnen" sideBottom="Bereich" directory />
      </a>
    );
  }

  return (
    <ActionModal
      title="Dateidetails"
      trigger={<DocumentRowContent iconLabel={fileIcon(entry.mimeType)} title={entry.name} subtitle={`${formatFileSize(entry.fileSize)} · ${formatDate(entry.updatedAt)}`} sideTop={entry.previewable ? "Vorschau" : "Download"} sideBottom="Datei" />}
      triggerClassName="document-row-trigger document-file-trigger"
      modalId={`file-${rootId}-${safeModalId(entry.relativePath)}`}
    >
      <div className="document-detail-sheet">
        <div className="document-detail-head">
          <span className="document-detail-icon" aria-hidden="true"><FileText size={19} /></span>
          <div className="task-detail-title-block">
            <h3>{entry.name}</h3>
            <span>{formatFileSize(entry.fileSize)} · aktualisiert {formatDate(entry.updatedAt)}</span>
          </div>
        </div>
        <dl className="task-detail-meta document-detail-meta">
          <div><HardDrive size={18} aria-hidden="true" /><dt>Bereich</dt><dd>Dateibereich</dd></div>
          <div><FileText size={18} aria-hidden="true" /><dt>Typ</dt><dd>{fileIcon(entry.mimeType)}</dd></div>
          <div><CalendarDays size={18} aria-hidden="true" /><dt>Aktualisiert</dt><dd>{formatDate(entry.updatedAt)}</dd></div>
        </dl>
        <div className="task-detail-note document-detail-path">
          <span>Pfad</span>
          <p>{entry.relativePath}</p>
        </div>
        <div className="document-detail-actions">
          <DocumentFilePreview
            href={`/api/documents/file?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entry.relativePath)}`}
            downloadHref={`/api/documents/file?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entry.relativePath)}&download=1`}
            fileName={entry.name}
            mimeType={entry.mimeType}
            disabled={!entry.previewable}
          />
          <a className="button secondary" href={`/api/documents/file?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entry.relativePath)}&download=1`}>
            <Download size={16} aria-hidden="true" />
            <span>Download</span>
          </a>
          <ActionModal
            title="Datei als Verweis speichern"
            trigger={<><Save size={16} aria-hidden="true" /><span>Speichern</span></>}
            triggerClassName="button"
            modalId={`save-file-${rootId}-${safeModalId(entry.relativePath)}`}
            sheetVariant="create"
            wide
          >
            <form action={createLocalDocumentReference} className="form form-grid modal-form document-edit-form">
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
      </div>
    </ActionModal>
  );
}

function DocumentRowContent({
  iconLabel,
  title,
  subtitle,
  sideTop,
  sideBottom,
  directory = false
}: {
  iconLabel: string;
  title: string;
  subtitle: string;
  sideTop: string;
  sideBottom: string;
  directory?: boolean;
}) {
  return (
    <span className="document-row">
      <span className="document-icon" aria-hidden="true">{directory ? <Folder size={18} /> : iconLabel}</span>
      <span className="document-row-main">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="document-row-side">
        <span>{sideTop}</span>
        <small>{sideBottom}</small>
      </span>
    </span>
  );
}

function DocumentEditModal({ document }: { document: DocumentLike }) {
  return (
    <ActionModal
      title="Dokument bearbeiten"
      trigger={<Pencil size={18} aria-hidden="true" />}
      triggerLabel="Dokument bearbeiten"
      triggerClassName="task-detail-edit-button document-detail-edit-button"
      panelClassName="document-edit-dialog"
      sheetVariant="create"
      wide
      modalId={`document-${document.id}-edit`}
    >
      <AutosaveForm action={updateDocumentReference} className="form form-grid modal-form document-edit-form">
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

function Breadcrumbs({ params, rootId, rootName, path }: { params: DocumentPageParams; rootId: string; rootName: string; path: string }) {
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

function filterDocumentsBySearch(documents: Awaited<ReturnType<typeof getVisibleDocuments>>, query: string) {
  return documents.filter((document) => !query || [
    document.title,
    document.description,
    document.url,
    document.fileName,
    document.relativePath,
    document.documentRoot?.name,
    document.owner.name,
    document.linkedEntityType,
    linkedEntityLabels[document.linkedEntityType]
  ].some((value) => normalizeSearch(value).includes(query)));
}

function filterDocumentsByTab(documents: Awaited<ReturnType<typeof getVisibleDocuments>>, tab: DocumentTab) {
  return documents.filter((document) => {
    if (tab === "files") return document.referenceType === "LOCAL_FILE";
    if (tab === "links") return document.referenceType !== "LOCAL_FILE";
    if (tab === "linked") return document.linkedEntityType !== "GENERAL";
    return true;
  });
}

function documentHref(params: DocumentPageParams, updates: Partial<DocumentPageParams>) {
  const search = new URLSearchParams();
  const next = { ...params, ...updates };
  for (const key of ["q", "tab", "root", "path"] as const) {
    const value = next[key];
    if (value && !(key === "tab" && value === "all")) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/dokumente?${query}` : "/dokumente";
}

function normalizeDocumentParams(params: DocumentPageParams): DocumentToolbarParams {
  const normalized: DocumentToolbarParams = {};
  if (params.q) normalized.q = params.q;
  const tab = getDocumentTab(params.tab);
  if (tab !== "all") normalized.tab = tab;
  if (params.root) normalized.root = params.root;
  if (params.path) normalized.path = params.path;
  return normalized;
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

function safeModalId(value: string) {
  return value.replace(/[^a-z0-9]/gi, "-");
}

const documentTabs = [
  { id: "all", label: "Alle" },
  { id: "files", label: "Dateien" },
  { id: "links", label: "Links" },
  { id: "linked", label: "Verknüpft" }
] as const;

type DocumentTab = typeof documentTabs[number]["id"];

const documentTabLabels: Record<DocumentTab, string> = {
  all: "Alle",
  files: "Dateien",
  links: "Links",
  linked: "Verknüpft"
};

const linkedEntityLabels = {
  EXPENSE: "Ausgabe",
  TASK: "Aufgabe",
  CONTRACT: "Vertrag",
  GENERAL: "Allgemein"
};

type DocumentLike = Awaited<ReturnType<typeof getVisibleDocuments>>[number];
