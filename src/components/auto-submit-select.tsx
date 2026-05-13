"use client";

import type { ChangeEvent } from "react";

type AutoSubmitSelectProps = {
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
};

export function AutoSubmitSelect({ name, defaultValue, className, children }: AutoSubmitSelectProps) {
  function submitForm(event: ChangeEvent<HTMLSelectElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <select name={name} defaultValue={defaultValue} className={className} onChange={submitForm}>
      {children}
    </select>
  );
}
