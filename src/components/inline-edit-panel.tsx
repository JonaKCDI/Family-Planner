"use client";

import type React from "react";
import { useRef, useState } from "react";

type InlineEditPanelProps = {
  trigger: string;
  children: React.ReactNode;
};

export function InlineEditPanel({ trigger, children }: InlineEditPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggleOpen() {
    if (open && !submitDirtyAutosaveForms(panelRef.current)) return;
    setOpen((current) => !current);
  }

  return (
    <>
      <button className="button secondary" type="button" onClick={toggleOpen} aria-expanded={open}>
        {open ? "Fertig" : trigger}
      </button>
      {open ? (
        <div className="management-inline-panel" ref={panelRef}>
          {children}
        </div>
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
