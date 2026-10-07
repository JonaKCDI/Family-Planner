"use client";

import { useState } from "react";
import { Eye, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";

type DocumentFilePreviewProps = {
  href: string;
  downloadHref: string;
  fileName: string;
  mimeType?: string | null;
  disabled?: boolean;
  compact?: boolean;
};

export function DocumentFilePreview({ href, downloadHref, fileName, mimeType, disabled = false, compact = false }: DocumentFilePreviewProps) {
  const [open, setOpen] = useState(false);
  const previewKind = getPreviewKind(mimeType);

  if (disabled || previewKind === "download") {
    return null;
  }

  return (
    <>
      <button className={compact ? "document-preview-icon-button" : "button"} type="button" onClick={() => setOpen(true)} aria-label={`${fileName} ansehen`} title="Vorschau">
        {compact ? <Eye size={18} aria-hidden="true" /> : "Vorschau"}
      </button>
      {open ? (
        <ModalPortal>
          <div className="modal-backdrop action-modal-backdrop" role="presentation">
            <section className="modal-panel document-preview-modal" role="dialog" aria-modal="true" aria-labelledby="document-preview-title">
              <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
              <div className="modal-head">
                <div>
                  <span className="eyebrow">Vorschau</span>
                  <h2 className="section-title" id="document-preview-title">{fileName}</h2>
                </div>
              </div>
              <div className="modal-body document-preview-body">
                {previewKind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="document-preview-image" src={href} alt={fileName} />
                ) : (
                  <iframe className="document-preview-frame" src={href} title={fileName} />
                )}
              </div>
              <div className="modal-submit-row modal-footer document-preview-footer">
                <a className="button secondary" href={downloadHref}>Download</a>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}

function getPreviewKind(mimeType?: string | null) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType === "text/plain" || mimeType === "text/csv") return "text";
  return "download";
}
