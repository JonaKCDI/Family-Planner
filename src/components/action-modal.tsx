"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const panelRef = useRef<HTMLElement>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = localOpen || (modalId ? searchParams.get("modal") === resolvedModalId : false);

  function setModalParam(nextOpen: boolean) {
    if (!modalId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (nextOpen) params.set("modal", resolvedModalId);
    else if (params.get("modal") === resolvedModalId) params.delete("modal");
    const query = params.toString();
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    router.replace(`${pathname}${query ? `?${query}` : ""}${hash}`, { scroll: false });
  }

  function openModal() {
    setLocalOpen(true);
    setModalParam(true);
  }

  function closeModal() {
    if (!submitDirtyAutosaveForms(panelRef.current)) return;
    setLocalOpen(false);
    setModalParam(false);
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
              ref={panelRef}
              className={wide ? "modal-panel action-modal action-modal-wide" : "modal-panel action-modal"}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`action-modal-${resolvedModalId}`}
              onSubmit={(event) => {
                const form = event.target instanceof HTMLFormElement ? event.target : null;
                if (!event.defaultPrevented && form?.method.toLowerCase() === "get") window.setTimeout(closeModal, 0);
              }}
            >
              <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={closeModal}>
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

function submitDirtyAutosaveForms(root: HTMLElement | null) {
  if (!root) return true;
  const forms = [...root.querySelectorAll<HTMLFormElement>("form[data-autosave-form='true']")];
  for (const form of forms) {
    if (form.dataset.autosaveDirty !== "true") continue;
    if (!form.reportValidity()) return false;
    form.requestSubmit();
  }
  return true;
}
