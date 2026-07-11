import type { HTMLAttributes, ReactNode } from "react";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="page-head app-page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty app-empty-state">{children}</div>;
}

export function ScopeSelect({ defaultValue = "FAMILY" }: { defaultValue?: "PRIVATE" | "FAMILY" }) {
  return (
    <label>
      Sichtbarkeit
      <select name="scope" defaultValue={defaultValue}>
        <option value="FAMILY">Familie</option>
        <option value="PRIVATE">Privat</option>
      </select>
    </label>
  );
}

type Tone = "brand" | "positive" | "negative" | "neutral" | "warning";

function toneClass(prefix: string, tone: Tone) {
  return `${prefix}-${tone}`;
}

export function SectionCard({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </section>
  );
}

export function MetricCard({
  className,
  label,
  value,
  detail,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLElement> & {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
}) {
  return (
    <article className={["stat", toneClass("metric", tone), className].filter(Boolean).join(" ")} {...props}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function Chip({ className, children, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={["badge", toneClass("chip", tone), className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}

export function StatusBadge({ className, children, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={["badge", "status-chip", toneClass("status", tone), className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}

export function ExpandableListItem({
  summary,
  meta,
  value,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDetailsElement> & {
  summary: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className={["card", "expand-item", className].filter(Boolean).join(" ")} {...props}>
      <summary className="row">
        <span>
          <strong>{summary}</strong>
          {meta ? <small className="muted">{meta}</small> : null}
        </span>
        {value ? <span>{value}</span> : null}
      </summary>
      <div className="spacing-top">
        {children}
      </div>
    </details>
  );
}
