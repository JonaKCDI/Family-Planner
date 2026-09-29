"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { financeAreaHref } from "@/lib/finance-area";

export function FinanceAreaIndicator() {
  const pathname = usePathname();
  const params = useSearchParams();
  const family = params.get("bereich") === "familie";
  const href = (area: "persoenlich" | "familie") => financeAreaHref(pathname, params.toString(), area);
  const nextArea = family ? "persoenlich" : "familie";
  return <Link className="finance-area-indicator" href={href(nextArea)} aria-label={`Zu ${family ? "persönlichen" : "Familien"} Finanzen wechseln`}>{family ? "Familie" : "Persönlich"}</Link>;
}

// Kept as a compatibility export for planning/setup routes; those routes now
// receive the same compact inline switch instead of the former segmented bar.
export const FinanceAreaSwitch = FinanceAreaIndicator;
