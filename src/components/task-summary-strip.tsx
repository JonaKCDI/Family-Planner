"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";

type TaskSummaryView = "active" | "overdue" | "today" | "planned" | "done" | "all";

type TaskSummaryItem = {
  count: number;
  href: string;
  label: string;
  view: Exclude<TaskSummaryView, "all" | "done">;
};

type TaskSummaryStripProps = {
  items: TaskSummaryItem[];
  view: TaskSummaryView;
};

const viewIndexes: Record<Exclude<TaskSummaryView, "all" | "done">, number> = {
  active: 0,
  overdue: 1,
  today: 2,
  planned: 3
};

export function TaskSummaryStrip({ items, view }: TaskSummaryStripProps) {
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<TaskSummaryView>(view);
  const [highlightIndex, setHighlightIndex] = useState(() => view === "all" || view === "done" ? 0 : viewIndexes[view]);
  const [withoutSlide, setWithoutSlide] = useState(false);
  const selectedIndex = selectedView === "all" || selectedView === "done" ? -1 : viewIndexes[selectedView];

  return (
    <section
      className={`task-summary-strip ${selectedIndex < 0 ? "is-clear" : "has-selection"} ${withoutSlide ? "no-slide" : ""}`}
      style={{ "--task-summary-index": highlightIndex } as React.CSSProperties}
      aria-label="Aufgabenansicht"
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
              const nextView = active ? "all" : item.view;
              const wasClear = selectedView === "all" || selectedView === "done";
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
