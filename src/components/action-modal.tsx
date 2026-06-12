"use client";

import type React from "react";
import { useId, useState } from "react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ModalPortal } from "@/components/modal-portal";

type ActionModalProps = {
  title: string;
  trigger: React.ReactNode;
  triggerLabel?: string;
  modalId?: string;
  triggerClassName?: string;
  wide?: boolean;
  children: React.ReactNode;
};

export function ActionModal({ title, trigger, triggerLabel, modalId, triggerClassName = "button secondary", wide = false, children }: ActionModalProps) {
  const generatedId = useId();
  const resolvedModalId = modalId ?? `modal-${generatedId.replace(/:/g, "")}`;
  const [localOpen, setLocalOpen] = useState(false);
  const [locallyClosed, setLocallyClosed] = useState(false);
  const searchParams = useSearchParams();
  const openFromUrl = modalId ? searchParams.get("modal") === resolvedModalId : false;
  const open = localOpen || (openFromUrl && !locallyClosed);

  function setModalParam(nextOpen: boolean) {
    if (!modalId) return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    if (nextOpen) params.set("modal", resolvedModalId);
    else if (params.get("modal") === resolvedModalId) params.delete("modal");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openModal() {
    setLocalOpen(true);
    setLocallyClosed(false);
    setModalParam(true);
  }

  function closeModal(updateUrl = true) {
    setLocalOpen(false);
    setLocallyClosed(true);
    if (updateUrl) setModalParam(false);
  }

  return (
    <>
      <button className={triggerClassName} type="button" aria-label={triggerLabel} title={triggerLabel} onClick={(event) => { event.stopPropagation(); openModal(); }}>
        {trigger}
      </button>
      {open ? (
        <ModalPortal>
          <div className="modal-backdrop action-modal-backdrop" role="presentation">
            <section
              className={wide ? "modal-panel action-modal action-modal-wide" : "modal-panel action-modal"}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`action-modal-${resolvedModalId}`}
              onSubmit={(event) => {
                const form = event.target instanceof HTMLFormElement ? event.target : null;
                if (!event.defaultPrevented && form) window.setTimeout(() => closeModal(false), 0);
              }}
            >
              <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={() => closeModal()}>
                <X size={20} />
              </button>
              <div className="modal-head">
                <h2 className="section-title" id={`action-modal-${resolvedModalId}`}>{title}</h2>
              </div>
              {children}
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
