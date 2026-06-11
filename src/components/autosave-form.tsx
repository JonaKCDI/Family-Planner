"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

type AutosaveFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  statusKey?: string;
  children: React.ReactNode;
};

export function AutosaveForm({ action, className, statusKey, children }: AutosaveFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!statusKey) return;
    const value = window.sessionStorage.getItem(storageKey(statusKey));
    if (!value) return;
    const savedAt = Number(value);
    if (Number.isFinite(savedAt) && Date.now() - savedAt < 7000) {
      const showTimer = window.setTimeout(() => setSaved(true), 0);
      const hideTimer = window.setTimeout(() => setSaved(false), 4500);
      return () => {
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
      };
    }
    window.sessionStorage.removeItem(storageKey(statusKey));
  }, [statusKey]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const details = form.closest("details");
    if (!details) return;
    const currentForm = form;
    const currentDetails = details;

    function handleToggle() {
      if (!currentDetails.open) submitIfDirty(currentForm);
    }

    currentDetails.addEventListener("toggle", handleToggle);
    return () => currentDetails.removeEventListener("toggle", handleToggle);
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (form) form.dataset.autosaveDirty = dirty ? "true" : "false";
  }, [dirty]);

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      data-autosave-form="true"
      data-autosave-dirty={dirty ? "true" : "false"}
      onInput={() => {
        setDirty(true);
        setSaved(false);
      }}
      onChange={() => {
        setDirty(true);
        setSaved(false);
      }}
      onSubmit={() => {
        const returnTo = formRef.current?.elements.namedItem("returnTo");
        if (returnTo instanceof HTMLInputElement) {
          returnTo.value = `${window.location.pathname}${window.location.search}`;
        }
        if (statusKey) window.sessionStorage.setItem(storageKey(statusKey), String(Date.now()));
        setDirty(false);
        setSaved(true);
      }}
    >
      {children}
      <span className={saved && !dirty ? "autosave-status saved" : "autosave-status"} aria-live="polite">
        Gespeichert
      </span>
    </form>
  );
}

function submitIfDirty(form: HTMLFormElement) {
  if (form.dataset.autosaveDirty !== "true") return;
  if (!form.reportValidity()) return;
  form.requestSubmit();
}

function storageKey(key: string) {
  return `autosave-status:${key}`;
}
