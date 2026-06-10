"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type ExcelProgressPanelProps = {
  children: ReactNode;
};

const fallbackMessage = "Excel wird vorbereitet ...";

export function ExcelProgressPanel({ children }: ExcelProgressPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);

  function clearProgress() {
    setMessage(null);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const activeElement = activeElementRef.current;
    if (activeElement instanceof HTMLButtonElement) {
      activeElement.disabled = false;
    }
    if (activeElement instanceof HTMLAnchorElement) {
      activeElement.removeAttribute("aria-disabled");
    }
    activeElementRef.current = null;
  }

  useEffect(() => {
    const clear = () => clearProgress();
    window.addEventListener("pageshow", clear);
    window.addEventListener("focus", clear);
    return () => {
      window.removeEventListener("pageshow", clear);
      window.removeEventListener("focus", clear);
      clearProgress();
    };
  }, []);

  function startProgress(nextMessage: string, activeElement: HTMLElement | null) {
    clearProgress();
    activeElementRef.current = activeElement;
    if (activeElement instanceof HTMLButtonElement) {
      activeElement.disabled = true;
    }
    if (activeElement instanceof HTMLAnchorElement) {
      activeElement.setAttribute("aria-disabled", "true");
    }
    setMessage(nextMessage || fallbackMessage);
    timeoutRef.current = window.setTimeout(clearProgress, 45000);
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-excel-progress]");
    if (!trigger || !(trigger instanceof HTMLAnchorElement)) return;
    if (trigger.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    startProgress(trigger.dataset.excelProgress ?? fallbackMessage, trigger);
  }

  function handleSubmit(event: React.FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.checkValidity()) return;
    const nativeEvent = event.nativeEvent;
    const submitter = "submitter" in nativeEvent && nativeEvent.submitter instanceof HTMLElement ? nativeEvent.submitter : null;
    const message = submitter?.dataset.excelProgress ?? form.dataset.excelProgress;
    if (!message) return;
    startProgress(message, submitter);
  }

  return (
    <div className="excel-progress-panel" onClick={handleClick} onSubmit={handleSubmit}>
      {children}
      {message ? (
        <div className="excel-progress-status" role="status" aria-live="polite">
          <span>{message}</span>
          <span className="excel-progress-bar" aria-hidden="true">
            <span />
          </span>
        </div>
      ) : null}
    </div>
  );
}
