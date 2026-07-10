"use client";

import type React from "react";
import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BottomSheet } from "@/components/ui-system";

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
      <BottomSheet
        open={open}
        onOpenChange={(nextOpen) => { if (nextOpen) openModal(); else closeModal(); }}
        title={title}
        wide={wide}
        labelledById={`action-modal-${resolvedModalId}`}
        onSubmit={(event) => {
          const form = event.target instanceof HTMLFormElement ? event.target : null;
          if (!event.defaultPrevented && form) window.setTimeout(() => closeModal(false), 0);
        }}
      >
        {children}
      </BottomSheet>
    </>
  );
}
