import Link from "next/link";
import type { ReactNode } from "react";

export type DesktopRecord = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: "attention" | "positive";
};

export function desktopSelectionHref(pathname: string, params: object, id: string) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "selected" || key === "modal" || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "string" && item) search.append(key, item);
    }
  }
  search.set("selected", id);
  return `${pathname}?${search.toString()}`;
}

export function desktopSelectedRecord<T extends { id: string }>(records: T[], id: string | undefined) {
  return records.find((record) => record.id === id) ?? records[0] ?? null;
}

export function DesktopWorkspace({
  ariaLabel,
  title,
  description,
  rows,
  selectedId,
  pathname,
  params,
  detail,
  controls,
  empty = "Keine Einträge vorhanden.",
  className = ""
}: {
  ariaLabel: string;
  title: string;
  description?: string;
  rows: DesktopRecord[];
  selectedId?: string;
  pathname: string;
  params: object;
  detail: ReactNode;
  controls?: ReactNode;
  empty?: string;
  className?: string;
}) {
  return <section className={`desktop-workspace ${className}`} aria-label={ariaLabel}>
    <div className="desktop-workspace-list">
      <header className="desktop-workspace-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><div className="desktop-workspace-controls">{controls}<span>{rows.length}{rows.length > 6 && <small>↕ Liste scrollen</small>}</span></div></header>
      <div className="desktop-workspace-rows">
        {rows.length === 0 && <p className="desktop-workspace-empty">{empty}</p>}
        {rows.map((row) => <Link
          prefetch={false}
          className={`desktop-workspace-row${selectedId === row.id ? " is-selected" : ""}${row.tone ? ` tone-${row.tone}` : ""}`}
          href={desktopSelectionHref(pathname, params, row.id)}
          aria-current={selectedId === row.id ? "true" : undefined}
          key={row.id}
          scroll={false}
        ><span><strong>{row.title}</strong>{row.subtitle && <small>{row.subtitle}</small>}</span>{row.meta && <em>{row.meta}</em>}</Link>)}
      </div>
    </div>
    <aside className="desktop-workspace-detail" aria-label="Details">{detail ?? <p className="desktop-workspace-empty">Wähle einen Eintrag aus.</p>}</aside>
  </section>;
}

export function DesktopDetail({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  return <div className="desktop-detail">
    <header className="desktop-detail-head"><div>{eyebrow && <span>{eyebrow}</span>}<h3>{title}</h3></div>{actions && <div className="desktop-detail-actions">{actions}</div>}</header>
    {children}
  </div>;
}

export function DesktopFacts({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="desktop-facts">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
