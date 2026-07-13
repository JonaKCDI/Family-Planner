"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
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
  const [closing, setClosing] = useState(false);
  const [rootId, setRootId] = useState(roots[0]?.id ?? "");
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<DocumentFileEntry[]>([]);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
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
    const alreadySelected = selected?.rootId === selectedRoot.id && selected.relativePath === entry.relativePath;
    setSelected(alreadySelected ? null : {
      rootId: selectedRoot.id,
      rootName: selectedRoot.name,
      relativePath: entry.relativePath,
      name: entry.name
    });
  }

  function closePicker() {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 180);
  }

  function openDirectory(nextPath: string) {
    setPath(nextPath);
  }

  function changeRoot(nextRootId: string) {
    setRootId(nextRootId);
    setPath("");
  }

  return (
    <div className="document-inline-picker full-span">
      <input type="hidden" name="documentRootId" value={selected?.rootId ?? ""} />
      <input type="hidden" name="documentRelativePath" value={selected?.relativePath ?? ""} />
      <div className="document-picker-summary">
        <span>NAS-Datei</span>
        <div className="document-picker-control">
          <strong>{selected ? selected.name : "Keine ausgewählt"}</strong>
          <div className="entry-actions">
            {selected ? <button className="button secondary" type="button" onClick={() => setSelected(null)} aria-label="Ausgewählte NAS-Datei entfernen">Entfernen</button> : null}
            <button className="button secondary" type="button" onClick={() => setOpen(true)} disabled={roots.length === 0}>
              Datei auswählen
            </button>
          </div>
        </div>
      </div>

      {roots.length === 0 ? <p className="muted">Kein Dokumentbereich freigegeben.</p> : null}

      {open || closing ? (
        <ModalPortal>
          <div className={closing ? "modal-backdrop action-modal-backdrop is-closing" : "modal-backdrop action-modal-backdrop"} role="presentation">
            <section className="modal-panel action-modal action-modal-wide document-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="document-picker-title">
              <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={closePicker}>
                <X size={20} />
              </button>
              <div className="modal-head">
                <h2 className="section-title" id="document-picker-title">Datei auswählen</h2>
              </div>
              <div className="modal-body">
                <div className="document-explorer-toolbar document-picker-toolbar">
                  <div className="document-root-switcher" aria-label="Dokumentbereich">
                    <span>Bereich</span>
                    {roots.length > 3 ? (
                      <select value={selectedRoot?.id ?? ""} onChange={(event) => changeRoot(event.currentTarget.value)} aria-label="Dokumentbereich auswählen">
                        {roots.map((root) => (
                          <option value={root.id} key={root.id}>{root.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        {roots.map((root) => (
                          <button className={selectedRoot?.id === root.id ? "active" : ""} type="button" onClick={() => changeRoot(root.id)} key={root.id}>
                            {root.name}
                          </button>
                        ))}
                      </div>
                    )}
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
                      <article className="document-file-row document-file-entry" key={entry.relativePath}>
                        <div className="document-file-main">
                          <span className="document-icon" aria-hidden="true">{fileIcon(entry.mimeType)}</span>
                          <span><strong>{entry.name}</strong><small>{formatFileSize(entry.fileSize)}</small></span>
                        </div>
                        <div className="document-file-actions">
                          <DocumentFilePreview
                            href={`/api/documents/file?rootId=${encodeURIComponent(selectedRoot?.id ?? rootId)}&path=${encodeURIComponent(entry.relativePath)}`}
                            downloadHref={`/api/documents/file?rootId=${encodeURIComponent(selectedRoot?.id ?? rootId)}&path=${encodeURIComponent(entry.relativePath)}&download=1`}
                            fileName={entry.name}
                            mimeType={entry.mimeType}
                            disabled={!entry.previewable}
                            compact
                          />
                          <button
                            className={selected?.rootId === selectedRoot?.id && selected.relativePath === entry.relativePath ? "document-select-check is-selected" : "document-select-check"}
                            type="button"
                            onClick={() => chooseFile(entry)}
                            aria-label={`${entry.name} ${selected?.rootId === selectedRoot?.id && selected.relativePath === entry.relativePath ? "abwählen" : "auswählen"}`}
                            aria-pressed={selected?.rootId === selectedRoot?.id && selected.relativePath === entry.relativePath}
                          >
                            <Check size={16} aria-hidden="true" />
                          </button>
                        </div>
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
