"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
};

export function ConfirmSubmitButton({
  children,
  title = "Wirklich löschen?",
  message = "Diese Aktion kann nicht rückgängig gemacht werden.",
  confirmLabel = "Löschen",
  cancelLabel = "Abbrechen",
  className = "button secondary danger-subtle"
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = buttonRef.current;
    document.documentElement.classList.add("modal-scroll-locked");
    window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      if (!document.querySelector(".modal-panel")) {
        document.documentElement.classList.remove("modal-scroll-locked");
      }
      trigger?.focus();
    };
  }, [open]);

  function submitClosestForm() {
    const form = buttonRef.current?.closest("form");
    setOpen(false);
    window.setTimeout(() => form?.requestSubmit(), 0);
  }

  return (
    <>
      <button ref={buttonRef} className={className} type="button" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? (
        <ModalPortal>
          <div className="confirm-sheet-backdrop" role="presentation" onClick={() => setOpen(false)}>
            <section className="confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-sheet-title" aria-describedby="confirm-sheet-message" onClick={(event) => event.stopPropagation()}>
              <span className="confirm-sheet-icon" aria-hidden="true"><AlertTriangle size={21} /></span>
              <div className="confirm-sheet-copy">
                <h2 id="confirm-sheet-title">{title}</h2>
                <p id="confirm-sheet-message">{message}</p>
              </div>
              <div className="confirm-sheet-actions">
                <button ref={cancelRef} className="button secondary" type="button" onClick={() => setOpen(false)}>{cancelLabel}</button>
                <button className="button danger-subtle" type="button" onClick={submitClosestForm}>{confirmLabel}</button>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
