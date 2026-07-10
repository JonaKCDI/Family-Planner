import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui-system";

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

export { SectionCard };
