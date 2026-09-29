"use client";

import { HandCoins } from "lucide-react";

export function FamilyTransferAction({ compact = false }: { compact?: boolean }) {
  return <button className={compact ? "icon-button" : "button secondary"} type="button" onClick={() => window.dispatchEvent(new Event("open-family-transfer"))} aria-label="Ausgleich eintragen" title="Ausgleich eintragen">
    <HandCoins size={compact ? 18 : 16} aria-hidden="true" />
    {!compact ? "Ausgleich eintragen" : null}
  </button>;
}
