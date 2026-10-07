"use client";

import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";

type ModalSheetProps = {
  open: boolean;
  closing?: boolean;
  onClose: () => void;
  title: string;
  labelledById: string;
  description?: string;
  leadingAction?: ReactNode;
  headerActions?: ReactNode;
  wide?: boolean;
  panelClassName?: string;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
};

export function ModalSheet({
  open,
  closing = false,
  onClose,
  title,
  labelledById,
  description,
  leadingAction,
  headerActions,
  wide = false,
  panelClassName,
  closeButtonRef,
  children
}: ModalSheetProps) {
  if (!open && !closing) return null;

  return (
    <ModalPortal>
      <div className={closing ? "modal-backdrop is-closing" : "modal-backdrop"} role="presentation">
        <section
          className={["modal-panel create-dialog create-from-fab", leadingAction ? "has-back-button" : null, wide ? "action-modal-wide" : null, panelClassName].filter(Boolean).join(" ")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledById}
        >
          {leadingAction}
          <button ref={closeButtonRef} className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={onClose}>
            <X size={20} />
          </button>
          <div className="modal-head">
            <div>
              <h2 id={labelledById}>{title}</h2>
              {description ? <p className="muted">{description}</p> : null}
            </div>
            {headerActions ? <div className="modal-head-actions">{headerActions}</div> : null}
          </div>
          {children}
        </section>
      </div>
    </ModalPortal>
  );
}
