"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

export function GlobalSubmitIndicator() {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let timeoutId: number | null = null;
    const clear = () => {
      setProcessing(false);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      if (!form.checkValidity() || isReadOnlyForm(form)) return;

      setProcessing(true);
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(clear, 30000);
    }

    document.addEventListener("submit", handleSubmit);
    window.addEventListener("pageshow", clear);
    window.addEventListener("focus", clear);
    return () => {
      document.removeEventListener("submit", handleSubmit);
      window.removeEventListener("pageshow", clear);
      window.removeEventListener("focus", clear);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!processing) return null;

  return (
    <div className="global-submit-indicator" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={17} aria-hidden="true" />
      <span>Wird verarbeitet ...</span>
    </div>
  );
}

function isReadOnlyForm(form: HTMLFormElement) {
  const method = form.method.toLowerCase();
  return method === "get" || form.classList.contains("search-bar") || form.classList.contains("compare-form");
}
