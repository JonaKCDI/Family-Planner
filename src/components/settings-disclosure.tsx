"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";

export function SettingsDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`settings-disclosure${open ? " is-open" : ""}`}>
      <button className="settings-disclosure-trigger" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Plus size={18} aria-hidden="true" /><span>{title}</span><ChevronDown size={17} aria-hidden="true" />
      </button>
      <div className="settings-disclosure-body" id={id} inert={!open}>
        <div>{children}</div>
      </div>
    </div>
  );
}
