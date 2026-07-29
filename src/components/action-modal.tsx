"use client";

import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ModalPortal } from "@/components/modal-portal";

type ActionModalProps = {
  title: string;
  trigger: React.ReactNode;
  triggerLabel?: string;
  modalId?: string;
  triggerClassName?: string;
  panelClassName?: string;
  sheetVariant?: "action" | "create";
  sheetSize?: "compact" | "medium" | "large";
  showBackButton?: boolean;
  wide?: boolean;
  children: React.ReactNode;
};

export function ActionModal({ title, trigger, triggerLabel, modalId, triggerClassName = "button secondary", panelClassName, sheetVariant = "action", sheetSize, showBackButton = false, wide = false, children }: ActionModalProps) {
  const generatedId = useId();
  const resolvedModalId = modalId ?? `modal-${generatedId.replace(/:/g, "")}`;
  const [localOpen, setLocalOpen] = useState(false);
  const [locallyClosed, setLocallyClosed] = useState(false);
  const [closing, setClosing] = useState(false);
  const searchParams = useSearchParams();
  const openFromUrl = modalId ? searchParams.get("modal") === resolvedModalId : false;
  const open = localOpen || (openFromUrl && !locallyClosed);
  const visible = open || closing;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!visible) return;
    const trigger = triggerRef.current;
    const parentPanel = trigger?.closest(".modal-panel");
    document.documentElement.classList.add("modal-scroll-locked");
    parentPanel?.classList.add("modal-panel-covered-by-child");
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      document.documentElement.classList.remove("modal-scroll-locked");
      parentPanel?.classList.remove("modal-panel-covered-by-child");
      trigger?.focus();
    };
  }, [visible]);

  function setModalParam(nextOpen: boolean) {
    if (!modalId) return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    if (nextOpen) params.set("modal", resolvedModalId);
    else if (params.get("modal") === resolvedModalId) params.delete("modal");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openModal() {
    setClosing(false);
    setLocalOpen(true);
    setLocallyClosed(false);
    setModalParam(true);
  }

  function closeModal(updateUrl = true) {
    setClosing(true);
    window.setTimeout(() => {
      setLocalOpen(false);
      setLocallyClosed(true);
      setClosing(false);
    }, 180);
    if (updateUrl) setModalParam(false);
  }

  const isCreateSheet = sheetVariant === "create";
  const backdropClassName = [
    isCreateSheet ? "modal-backdrop" : "modal-backdrop action-modal-backdrop",
    closing ? "is-closing" : ""
  ].filter(Boolean).join(" ");
  const panelClassNames = [
    isCreateSheet ? "modal-panel create-dialog" : "modal-panel action-modal task-sheet-modal",
    wide ? "action-modal-wide sheet-large" : `sheet-${sheetSize ?? "medium"}`,
    showBackButton ? "has-back-button" : "",
    panelClassName ?? ""
  ].filter(Boolean).join(" ");

  return (
    <>
      <button ref={triggerRef} className={triggerClassName} type="button" aria-label={triggerLabel} title={triggerLabel} onClick={(event) => { event.stopPropagation(); openModal(); }}>
        {trigger}
      </button>
      {visible ? (
        <ModalPortal>
          <div className={backdropClassName} role="presentation">
            <section
              className={panelClassNames}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`action-modal-${resolvedModalId}`}
            >
              {showBackButton ? (
                <button className="icon-button modal-back-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => closeModal()}>
                  <ArrowLeft size={19} aria-hidden="true" />
                </button>
              ) : null}
              <button ref={closeRef} className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={() => closeModal()}>
                <X size={20} />
              </button>
              <div className="modal-head">
                <h2 className="section-title" id={`action-modal-${resolvedModalId}`}>{title}</h2>
              </div>
              {isCreateSheet ? (
                <div className="create-dialog-body">
                  {children}
                </div>
              ) : (
                <div className="modal-body">
                  {children}
                </div>
              )}
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
