"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DocumentFilePreview } from "@/components/document-file-preview";
import { ModalPortal } from "@/components/modal-portal";

type DocumentRootOption = {
  id: string;
  name: string;
};

type DocumentFileEntry = {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
  mimeType: string;
  fileSize: number;
  updatedAt: string;
  previewable: boolean;
};

type SelectedFile = {
  rootId: string;
  rootName: string;
  relativePath: string;
  name: string;
};

export function DocumentFilePicker({ roots }: { roots: DocumentRootOption[] }) {
  const [open, setOpen] = useState(false);
  const [rootId, setRootId] = useState(roots[0]?.id ?? "");
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<DocumentFileEntry[]>([]);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRoot = useMemo(() => roots.find((root) => root.id === rootId) ?? roots[0] ?? null, [rootId, roots]);
  const breadcrumbs = path.split("/").filter(Boolean);

  useEffect(() => {
    if (!open || !selectedRoot) return;
    let cancelled = false;
    async function loadEntries() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ rootId: selectedRoot.id });
        if (path) params.set("path", path);
        const response = await fetch(`/api/documents/list?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Der Ordner ist nicht verfügbar.");
        if (!cancelled) setEntries(payload.entries ?? []);
      } catch (loadError) {
        if (!cancelled) {
          setEntries([]);
          setError(loadError instanceof Error ? loadError.message : "Der Ordner ist nicht verfügbar.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [open, path, selectedRoot]);

  function chooseFile(entry: DocumentFileEntry) {
    if (!selectedRoot) return;
    setSelected({
      rootId: selectedRoot.id,
      rootName: selectedRoot.name,
      relativePath: entry.relativePath,
      name: entry.name
    });
    setOpen(false);
  }

  function openDirectory(nextPath: string) {
    setActiveFilePath(null);
    setPath(nextPath);
  }

  function changeRoot(nextRootId: string) {
    setRootId(nextRootId);
    setPath("");
    setActiveFilePath(null);
  }

  function toggleFile(entry: DocumentFileEntry) {
    setActiveFilePath((current) => current === entry.relativePath ? null : entry.relativePath);
  }

  return (
    <div className="document-inline-picker full-span">
      <input type="hidden" name="documentRootId" value={selected?.rootId ?? ""} />
      <input type="hidden" name="documentRelativePath" value={selected?.relativePath ?? ""} />
      <div className="document-picker-summary">
        <div>
          <strong>{selected ? selected.name : "Keine NAS-Datei ausgewählt"}</strong>
          <span className="muted">
            {selected ? `${selected.rootName} / ${selected.relativePath}` : "Optional direkt aus einem freigegebenen Dokumentbereich wählen."}
          </span>
        </div>
        <div className="entry-actions">
          {selected ? <button className="button secondary" type="button" onClick={() => setSelected(null)}>Entfernen</button> : null}
          <button className="button secondary" type="button" onClick={() => setOpen(true)} disabled={roots.length === 0}>
            Datei auswählen
          </button>
        </div>
      </div>

      {roots.length === 0 ? <p className="muted">Noch kein Dokumentbereich freigegeben. Admins verwalten das in den Einstellungen.</p> : null}

      {open ? (
        <ModalPortal>
          <div className="modal-backdrop action-modal-backdrop" role="presentation">
            <section className="modal-panel action-modal action-modal-wide" role="dialog" aria-modal="true" aria-labelledby="document-picker-title">
              <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
              <div className="modal-head">
                <h2 className="section-title" id="document-picker-title">Datei auswählen</h2>
              </div>
              <div className="modal-body">
                <div className="document-explorer-toolbar document-picker-toolbar">
                  <div className="document-root-switcher" aria-label="Dokumentbereich">
                    <span>Bereich</span>
                    <div>
                      {roots.map((root) => (
                        <button className={selectedRoot?.id === root.id ? "active" : ""} type="button" onClick={() => changeRoot(root.id)} key={root.id}>
                          {root.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <nav className="document-path-bar" aria-label="Dateipfad">
                    <button type="button" onClick={() => openDirectory("")}>{selectedRoot?.name ?? "Dokumente"}</button>
                    {breadcrumbs.map((part, index) => {
                      const nextPath = breadcrumbs.slice(0, index + 1).join("/");
                      return (
                        <span className="document-path-part" key={nextPath}>
                          <span aria-hidden="true">/</span>
                          <button type="button" onClick={() => openDirectory(nextPath)}>{part}</button>
                        </span>
                      );
                    })}
                  </nav>

                  <span className="document-explorer-count">{entries.length} Einträge</span>
                </div>

                {loading ? <p className="muted">Lade Dateien ...</p> : null}
                {error ? <p className="negative">{error}</p> : null}
                {!loading && !error && entries.length === 0 ? <p className="muted">Dieser Ordner ist leer.</p> : null}

                <div className="document-file-list">
                  {entries.map((entry) => (
                    entry.kind === "directory" ? (
                      <button className="document-file-row document-file-button" type="button" onClick={() => openDirectory(entry.relativePath)} key={entry.relativePath}>
                        <span className="document-icon" aria-hidden="true">DIR</span>
                        <span><strong>{entry.name}</strong><small>Ordner</small></span>
                      </button>
                    ) : (
                      <article className="document-file-disclosure" key={entry.relativePath}>
                        <button className="document-file-row document-file-button" type="button" onClick={() => toggleFile(entry)} aria-expanded={activeFilePath === entry.relativePath}>
                          <span className="document-icon" aria-hidden="true">{fileIcon(entry.mimeType)}</span>
                          <span><strong>{entry.name}</strong><small>{formatFileSize(entry.fileSize)}</small></span>
                        </button>
                        {activeFilePath === entry.relativePath ? (
                          <div className="document-file-options">
                            <DocumentFilePreview
                              href={`/api/documents/file?rootId=${encodeURIComponent(selectedRoot?.id ?? rootId)}&path=${encodeURIComponent(entry.relativePath)}`}
                              downloadHref={`/api/documents/file?rootId=${encodeURIComponent(selectedRoot?.id ?? rootId)}&path=${encodeURIComponent(entry.relativePath)}&download=1`}
                              fileName={entry.name}
                              mimeType={entry.mimeType}
                              disabled={!entry.previewable}
                            />
                            <button className="button" type="button" onClick={() => chooseFile(entry)}>Auswählen</button>
                          </div>
                        ) : null}
                      </article>
                    )
                  ))}
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
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
