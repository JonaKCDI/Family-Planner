"use client";

import type React from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";

type ActionModalProps = {
  title: string;
  trigger: string;
  wide?: boolean;
  children: React.ReactNode;
};

export function ActionModal({ title, trigger, wide = false, children }: ActionModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open ? (
        <ModalPortal>
          <div className="modal-backdrop action-modal-backdrop" role="presentation">
            <section
              className={wide ? "modal-panel action-modal action-modal-wide" : "modal-panel action-modal"}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`action-modal-${trigger}`}
              onSubmit={(event) => {
                if (!event.defaultPrevented) setOpen(false);
              }}
            >
              <div className="modal-head">
                <h2 className="section-title" id={`action-modal-${trigger}`}>{title}</h2>
                <button className="icon-button" type="button" aria-label="Schließen" title="Schließen" onClick={() => setOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              {children}
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
