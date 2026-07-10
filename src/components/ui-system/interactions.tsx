"use client";

import type {
  ButtonHTMLAttributes,
  FormEventHandler,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { useEffect, useId, useRef } from "react";
import { ChevronDown, LoaderCircle, MoreHorizontal, Search, X } from "lucide-react";
import clsx from "clsx";
import { ModalPortal } from "@/components/modal-portal";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  leadingAction?: ReactNode;
  wide?: boolean;
  showHandle?: boolean;
  labelledById?: string;
  onSubmit?: FormEventHandler<HTMLElement>;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  leadingAction,
  wide = false,
  showHandle = true,
  labelledById,
  onSubmit
}: BottomSheetProps) {
  const generatedId = useId();
  const titleId = labelledById ?? `sheet-title-${generatedId.replace(/:/g, "")}`;
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusTarget = getFocusable(panel)[0] ?? panel;
    window.requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="modal-backdrop action-modal-backdrop app-sheet-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}>
        <section
          ref={panelRef}
          className={clsx("modal-panel action-modal app-sheet", wide && "action-modal-wide app-sheet-wide")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onSubmit={onSubmit}
        >
          {showHandle ? <span className="app-sheet-handle" aria-hidden="true" /> : null}
          <header className="modal-head app-sheet-head">
            {leadingAction ? <div className="app-sheet-leading">{leadingAction}</div> : null}
            <div className="app-sheet-title">
              <h2 className="section-title" id={titleId}>{title}</h2>
              {description ? <p className="muted">{description}</p> : null}
            </div>
            <button className="icon-button modal-close-button app-sheet-close" type="button" aria-label="Schließen" title="Schließen" onClick={() => onOpenChange(false)}>
              <X size={20} />
            </button>
          </header>
          <div className="modal-body app-sheet-body">
            {children}
          </div>
          {footer ? <footer className="modal-submit-row modal-footer app-sheet-footer">{footer}</footer> : null}
        </section>
      </div>
    </ModalPortal>
  );
}

function getFocusable(root: HTMLElement | null) {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hidden && element.offsetParent !== null);
}

type FieldShellProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function FieldShell({ label, required = false, error, hint, children }: FieldShellProps) {
  return (
    <label className={clsx("app-field", error && "app-field-invalid")}>
      <span className="app-field-label">{label}{required ? <em aria-hidden="true">*</em> : null}</span>
      {children}
      {hint ? <small className="app-field-hint">{hint}</small> : null}
      {error ? <small className="app-field-error">{error}</small> : null}
    </label>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & Omit<FieldShellProps, "children">;

export function TextInput({ label, required, error, hint, className, ...props }: TextInputProps) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <input className={clsx("app-input", className)} required={required} aria-invalid={Boolean(error)} {...props} />
    </FieldShell>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Omit<FieldShellProps, "children">;

export function TextArea({ label, required, error, hint, className, ...props }: TextAreaProps) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <textarea className={clsx("app-input app-textarea", className)} required={required} aria-invalid={Boolean(error)} {...props} />
    </FieldShell>
  );
}

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & Omit<FieldShellProps, "children">;

export function SelectInput({ label, required, error, hint, className, children, ...props }: SelectInputProps) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <select className={clsx("app-input app-select", className)} required={required} aria-invalid={Boolean(error)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

type ToggleProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
};

export function Toggle({ label, description, className, ...props }: ToggleProps) {
  return (
    <label className={clsx("app-toggle", className)}>
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input type="checkbox" {...props} />
    </label>
  );
}

type SegmentedControlProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function SegmentedControl({ label, children, className }: SegmentedControlProps) {
  return (
    <div className={clsx("app-segmented", className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

type SegmentButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function SegmentButton({ selected = false, className, children, ...props }: SegmentButtonProps) {
  return (
    <button className={clsx("app-segment", selected && "active", className)} type="button" aria-pressed={selected} {...props}>
      {children}
    </button>
  );
}

export function SheetTabs({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav className={clsx("app-sheet-tabs", className)} aria-label="Formularbereiche" {...props}>
      {children}
    </nav>
  );
}

type SearchDisclosureProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

export function SearchDisclosure({ label, expanded, onExpandedChange, children, className, ...props }: SearchDisclosureProps) {
  return (
    <div className={clsx("app-search-disclosure", expanded && "is-open", className)} {...props}>
      <button className="button secondary app-search-trigger" type="button" aria-expanded={expanded} onClick={() => onExpandedChange(!expanded)}>
        {expanded ? <X size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
        <span>{label}</span>
      </button>
      <div className="app-search-panel" aria-hidden={!expanded}>
        {children}
      </div>
    </div>
  );
}

export function FilterSheetLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("app-filter-layout", className)}>{children}</div>;
}

export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="fieldset app-filter-group">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

type ExpandableListItemProps = HTMLAttributes<HTMLDetailsElement> & {
  summary: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  children: ReactNode;
};

export function ExpandableListItem({ summary, meta, value, children, className, ...props }: ExpandableListItemProps) {
  return (
    <details className={clsx("app-expand-item", className)} {...props}>
      <summary>
        <span className="app-expand-main">
          <strong>{summary}</strong>
          {meta ? <small>{meta}</small> : null}
        </span>
        {value ? <span className="app-expand-value">{value}</span> : null}
        <ChevronDown className="app-expand-chevron" size={18} aria-hidden="true" />
      </summary>
      <div className="app-expand-body">
        {children}
      </div>
    </details>
  );
}

type OverflowMenuProps = {
  label?: string;
  children: ReactNode;
};

export function OverflowMenu({ label = "Weitere Aktionen", children }: OverflowMenuProps) {
  return (
    <details className="app-overflow-menu">
      <summary aria-label={label} title={label}>
        <MoreHorizontal size={18} aria-hidden="true" />
      </summary>
      <div className="app-overflow-panel" role="menu">
        {children}
      </div>
    </details>
  );
}

export function LoadingState({ children = "Lädt ..." }: { children?: ReactNode }) {
  return (
    <div className="app-state app-loading-state" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return <p className="app-state app-inline-error" role="alert">{children}</p>;
}

export function SuccessFeedback({ children }: { children: ReactNode }) {
  return <p className="app-state app-success-feedback" role="status">{children}</p>;
}
