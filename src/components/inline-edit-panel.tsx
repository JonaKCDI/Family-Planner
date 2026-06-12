"use client";

import type React from "react";
import { useState } from "react";

type InlineEditPanelProps = {
  trigger: string;
  children: React.ReactNode;
};

export function InlineEditPanel({ trigger, children }: InlineEditPanelProps) {
  const [open, setOpen] = useState(false);

  function toggleOpen() {
    setOpen((current) => !current);
  }

  return (
    <>
      <button className="button secondary" type="button" onClick={toggleOpen} aria-expanded={open}>
        {open ? "Fertig" : trigger}
      </button>
      {open ? (
        <div className="management-inline-panel">
          {children}
        </div>
      ) : null}
    </>
  );
}
