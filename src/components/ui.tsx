import type { ReactNode } from "react";

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
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
