"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";

export type ContractSummaryView = "active" | "attention" | "auto" | "ended" | "all";

type ContractSummaryItem = {
  count: number;
  href: string;
  label: string;
  view: Exclude<ContractSummaryView, "all">;
};

type ContractSummaryStripProps = {
  items: ContractSummaryItem[];
  view: ContractSummaryView;
};

const viewIndexes: Record<Exclude<ContractSummaryView, "all">, number> = {
  active: 0,
  attention: 1,
  auto: 2,
  ended: 3
};

export function ContractSummaryStrip({ items, view }: ContractSummaryStripProps) {
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<ContractSummaryView>(view);
  const [highlightIndex, setHighlightIndex] = useState(() => view === "all" ? 0 : viewIndexes[view]);
  const [withoutSlide, setWithoutSlide] = useState(false);
  const selectedIndex = selectedView === "all" ? -1 : viewIndexes[selectedView];

  return (
    <section
      className={`task-summary-strip contract-summary-strip ${selectedIndex < 0 ? "is-clear" : "has-selection"} ${withoutSlide ? "no-slide" : ""}`}
      style={{ "--task-summary-index": highlightIndex } as React.CSSProperties}
      aria-label="Vertragsansicht"
    >
      {items.map((item) => {
        const active = selectedView === item.view;
        return (
          <a
            className={active ? "active" : ""}
            href={item.href}
            key={item.view}
            onClick={(event) => {
              event.preventDefault();
              const nextView: ContractSummaryView = active ? "all" : item.view;
              const wasClear = selectedView === "all";
              if (!active && wasClear) {
                setWithoutSlide(true);
                window.setTimeout(() => setWithoutSlide(false), 220);
              }
              setSelectedView(nextView);
              if (!active) setHighlightIndex(viewIndexes[item.view]);
              router.push(item.href);
            }}
          >
            <strong>{item.count}</strong>
            <span>{item.label}</span>
          </a>
        );
      })}
    </section>
  );
}
