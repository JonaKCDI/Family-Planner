"use client";

import { useLayoutEffect } from "react";

const financeViewOrder = ["overview", "entries", "categories", "budgets", "labels", "compare", "planning"];

export function FinanceTransitionMarker({ view }: { view: string }) {
  useLayoutEffect(() => {
    const key = "family-app:last-finance-view";
    const previous = window.sessionStorage.getItem(key);
    const previousIndex = previous ? financeViewOrder.indexOf(previous) : -1;
    const nextIndex = financeViewOrder.indexOf(view);
    const direction = previousIndex >= 0 && nextIndex >= 0 && previousIndex > nextIndex
      ? "backward"
      : previousIndex >= 0 && nextIndex >= 0 && previousIndex < nextIndex
        ? "forward"
        : "neutral";
    document.documentElement.dataset.financeDirection = direction;
    window.sessionStorage.setItem(key, view);
    return () => {
      document.documentElement.dataset.financeDirection = "neutral";
    };
  }, [view]);

  return null;
}
