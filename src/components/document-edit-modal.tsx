"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, Pencil } from "lucide-react";
import { ActionModal } from "@/components/action-modal";
import { DocumentFilePicker } from "@/components/document-file-picker";
import { updateDocumentReference } from "@/lib/actions";

type EditableDocument = {
  id: string;
  title: string;
  referenceType: "LOCAL_FILE" | "EXTERNAL_URL" | "SYNOLOGY_HTTPS" | "WEBDAV_HTTPS";
  relativePath: string | null;
  fileName: string | null;
  url: string;
  documentRoot: { id: string; name: string } | null;
  linkedEntityType: "GENERAL" | "EXPENSE" | "TASK" | "CONTRACT";
  linkedEntityId: string | null;
  scope: "FAMILY" | "PRIVATE";
  description: string | null;
};

type DocumentRootOption = { id: string; name: string };

export function DocumentEditModal({ document, documentRoots }: { document: EditableDocument; documentRoots: DocumentRootOption[] }) {
  const [source, setSource] = useState<"link" | "file">(document.referenceType === "LOCAL_FILE" ? "file" : "link");
  const [panel, setPanel] = useState<"main" | "details">("main");
  const linkSelected = source === "link";
  const initialSelection = document.documentRoot && document.relativePath ? {
    rootId: document.documentRoot.id,
    rootName: document.documentRoot.name,
    relativePath: document.relativePath,
    name: document.fileName ?? document.relativePath.split("/").at(-1) ?? document.title
  } : null;

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
      <div className="form form-grid modal-form document-create-form">
        {!linkSelected ? (
          <form action={updateDocumentReference} className="form form-grid modal-form full-span document-create-source-form document-edit-form">
            <input type="hidden" name="id" value={document.id} />
            <input type="hidden" name="source" value="file" />
            {panel === "details" ? <DocumentDetailsSubhead onBack={() => setPanel("main")} /> : null}
            <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "main"}>
              <legend>Dokument</legend>
              <DocumentFilePicker roots={documentRoots} initialSelection={initialSelection} />
              {documentRoots.length === 0 ? <p className="muted">Ein Admin muss zuerst in den Einstellungen einen Dokumentbereich freigeben.</p> : null}
            </fieldset>
            <button className="flow-link document-more-details-link full-span" type="button" hidden={panel !== "main"} onClick={() => setPanel("details")}>
              <span>Weitere Angaben</span>
              <small>Zuordnung, Sichtbarkeit und Beschreibung</small>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button className="flow-link document-link-source-link full-span" type="button" hidden={panel !== "main"} onClick={() => { setSource("link"); setPanel("main"); }}>
              <span>HTTPS-Link statt NAS-Datei</span>
              <small>Für sichere Links zu Drive, WebDAV oder Synology.</small>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
              <legend>Zuordnung</legend>
              <div className="form-grid">
                <label>Titel optional<input name="title" defaultValue={document.title} placeholder="Leer lassen, um den Dateinamen zu verwenden" /></label>
                <label>Bezug<select name="linkedEntityType" defaultValue={document.linkedEntityType}><LinkedEntityOptions /></select></label>
                <label>Sichtbarkeit<select name="scope" defaultValue={document.scope}><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
                <label className="document-advanced-link-id">Interne Bezugs-ID optional<input name="linkedEntityId" defaultValue={document.linkedEntityId ?? ""} /></label>
              </div>
            </fieldset>
            <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
              <legend>Details</legend>
              <label>Beschreibung<textarea name="description" defaultValue={document.description ?? ""} /></label>
            </fieldset>
            <div className="modal-submit-row modal-footer">
              <button className="button full-span" type="submit" disabled={documentRoots.length === 0}>Speichern</button>
            </div>
          </form>
        ) : null}
        {linkSelected ? (
          <form action={updateDocumentReference} className="form form-grid modal-form full-span document-create-source-form document-edit-form">
            <input type="hidden" name="id" value={document.id} />
            <input type="hidden" name="source" value="link" />
            {panel === "details" ? <DocumentDetailsSubhead onBack={() => setPanel("main")} /> : <DocumentDetailsSubhead title="HTTPS-Link speichern" onBack={() => { setSource("file"); setPanel("main"); }} />}
            <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "main"}>
              <legend>Dokument</legend>
              <div className="form-grid">
                <input type="hidden" name="referenceType" value={document.referenceType === "LOCAL_FILE" ? "EXTERNAL_URL" : document.referenceType} />
                <label>Titel<input name="title" defaultValue={document.title} required /></label>
                <label>HTTPS-Link<input name="url" type="url" defaultValue={document.referenceType === "LOCAL_FILE" ? "" : document.url} placeholder="https://drive.google.com/..." required /></label>
              </div>
            </fieldset>
            <button className="flow-link document-more-details-link full-span" type="button" hidden={panel !== "main"} onClick={() => setPanel("details")}>
              <span>Weitere Angaben</span>
              <small>Zuordnung, Sichtbarkeit und Beschreibung</small>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
              <legend>Zuordnung</legend>
              <div className="form-grid">
                <label>Bezug<select name="linkedEntityType" defaultValue={document.linkedEntityType}><LinkedEntityOptions /></select></label>
                <label>Sichtbarkeit<select name="scope" defaultValue={document.scope}><option value="FAMILY">Familie</option><option value="PRIVATE">Privat</option></select></label>
                <label className="document-advanced-link-id">Interne Bezugs-ID optional<input name="linkedEntityId" defaultValue={document.linkedEntityId ?? ""} /></label>
              </div>
            </fieldset>
            <fieldset className="fieldset modal-form-section full-span" hidden={panel !== "details"}>
              <legend>Details</legend>
              <label>Beschreibung<textarea name="description" defaultValue={document.description ?? ""} /></label>
            </fieldset>
            <div className="modal-submit-row modal-footer">
              <button className="button full-span" type="submit">Speichern</button>
            </div>
          </form>
        ) : null}
      </div>
    </ActionModal>
  );
}

function LinkedEntityOptions() {
  return <>
    <option value="GENERAL">Allgemein</option>
    <option value="EXPENSE">Ausgabe</option>
    <option value="TASK">Aufgabe</option>
    <option value="CONTRACT">Vertrag</option>
  </>;
}

function DocumentDetailsSubhead({ onBack, title = "Weitere Angaben" }: { onBack: () => void; title?: string }) {
  return (
    <div className="task-create-subhead full-span document-details-subhead">
      <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <strong>{title}</strong>
      <span aria-hidden="true" />
    </div>
  );
}
