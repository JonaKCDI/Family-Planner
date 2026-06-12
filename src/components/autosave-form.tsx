"use client";

import type React from "react";
import { useRef } from "react";

type AutosaveFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  statusKey?: string;
  children: React.ReactNode;
};

export function AutosaveForm({ action, className, statusKey, children }: AutosaveFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  void statusKey;

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onSubmit={() => {
        const returnTo = formRef.current?.elements.namedItem("returnTo");
        if (returnTo instanceof HTMLInputElement) {
          returnTo.value = currentPathWithoutModalParam();
        }
      }}
    >
      {children}
    </form>
  );
}

function currentPathWithoutModalParam() {
  const params = new URLSearchParams(window.location.search);
  params.delete("modal");
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}
