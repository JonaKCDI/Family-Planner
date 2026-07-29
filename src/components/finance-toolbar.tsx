"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Funnel, Search, X } from "lucide-react";
import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { ExpenseFilterForm } from "@/components/expense-filter-form";
import { ModalPortal } from "@/components/modal-portal";

type FinanceToolbarProps = {
  params: ExpenseFilterParams;
  categories: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  years: number[];
  currentMonthKey: string;
  paymentMethods: string[];
  resultCount: number;
  activeFilterCount: number;
};

const SearchCloseContext = createContext<() => void>(() => {});

export function FinanceToolbar({
  params,
  categories,
  labels,
  years,
  currentMonthKey,
  paymentMethods,
  resultCount,
  activeFilterCount
}: FinanceToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(params.q));
  const [filterOpen, setFilterOpen] = useState(false);
  const resetHref = buildExpensesHref(params, {
    q: undefined,
    category: undefined,
    label: undefined,
    kind: undefined,
    paymentMethod: undefined,
    source: undefined,
    from: undefined,
    to: undefined,
    month: undefined,
    year: undefined
  });

  return (
    <div className="task-toolbar finance-toolbar" aria-label="Finanzwerkzeuge">
      <SearchDisclosure label="Finanzen durchsuchen" expanded={searchOpen} onExpandedChange={setSearchOpen} className="task-search finance-search">
        <form className="task-inline-search finance-inline-search" action="/ausgaben">
          <FinanceHiddenFields params={params} exclude={["q"]} />
          <SearchCloseControl href={params.q ? buildExpensesHref(params, { q: undefined }) : undefined} />
          <label>
            <span>Finanzen durchsuchen</span>
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Beschreibung, Kategorie, Label, Vertrag ..." autoFocus />
          </label>
          <button className="button secondary" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>Suchen</span>
          </button>
        </form>
      </SearchDisclosure>

      <IconButton className="task-filter-button finance-filter-button" label="Finanzen filtern" onClick={() => setFilterOpen(true)}>
        <Funnel size={18} aria-hidden="true" />
        {activeFilterCount > 0 ? <span className="task-filter-count">{activeFilterCount}</span> : null}
      </IconButton>

      <BottomSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Finanzen filtern"
        size="large"
        footer={(
          <>
            <a className="button secondary" href={resetHref}>Zurücksetzen</a>
            <button className="button" type="submit" form="finance-filter-form">{resultCount} Einträge anzeigen</button>
          </>
        )}
      >
        <ExpenseFilterForm
          params={params}
          categories={categories}
          labels={labels}
          years={years}
          currentMonthKey={currentMonthKey}
          paymentMethods={paymentMethods}
          resultCount={resultCount}
          formId="finance-filter-form"
          showActions={false}
        />
      </BottomSheet>
    </div>
  );
}

function FinanceHiddenFields({ params, exclude = [] }: { params: ExpenseFilterParams; exclude?: string[] }) {
  return (
    <>
      {Object.entries(params).flatMap(([key, value]) => {
        if (!value || exclude.includes(key)) return [];
        if (Array.isArray(value)) {
          return value.filter(Boolean).map((item) => <input type="hidden" name={key} value={item} key={`${key}-${item}`} />);
        }
        return [<input type="hidden" name={key} value={String(value)} key={key} />];
      })}
    </>
  );
}

function SearchCloseControl({ href }: { href?: string }) {
  const closeSearch = useContext(SearchCloseContext);

  return (
    <button
      className="task-search-close"
      type="button"
      aria-label="Suche schließen"
      title="Suche schließen"
      onClick={() => {
        closeSearch();
        if (href) window.setTimeout(() => { window.location.href = href; }, 180);
      }}
    >
      <X size={17} aria-hidden="true" />
    </button>
  );
}

function IconButton({
  className,
  children,
  label,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; label: string }) {
  return (
    <button className={["icon-button", className].filter(Boolean).join(" ")} type="button" aria-label={label} title={title ?? label} {...props}>
      {children}
    </button>
  );
}

function SearchDisclosure({
  label,
  expanded,
  onExpandedChange,
  children,
  className
}: {
  label: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const [phase, setPhase] = useState<"closed" | "open" | "closing">(expanded ? "open" : "closed");
  const renderSearch = phase !== "closed";

  function closeSearch() {
    if (phase === "closed") return;
    setPhase("closing");
    onExpandedChange(false);
    window.setTimeout(() => setPhase("closed"), 190);
  }

  function toggleSearch() {
    if (phase === "open") {
      closeSearch();
      return;
    }
    setPhase("open");
    onExpandedChange(true);
  }

  return (
    <div className={[className, renderSearch ? "is-open" : "", phase === "closing" ? "is-closing" : ""].filter(Boolean).join(" ")}>
      <button className="icon-button task-search-toggle" type="button" aria-label={label} title={label} aria-expanded={phase === "open"} onClick={toggleSearch}>
        {phase === "open" ? <X size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
      </button>
      {renderSearch ? <SearchCloseContext.Provider value={closeSearch}>{children}</SearchCloseContext.Provider> : null}
    </div>
  );
}

function BottomSheet({
  open,
  onOpenChange,
  title,
  size = "medium",
  footer,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  size?: "compact" | "medium" | "large";
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const titleId = "finance-sheet-title";

  function closeSheet() {
    setClosing(true);
    window.setTimeout(() => {
      onOpenChange(false);
      setClosing(false);
    }, 180);
  }

  if (!open && !closing) return null;

  return (
    <ModalPortal>
      <div className={closing ? "modal-backdrop action-modal-backdrop is-closing" : "modal-backdrop action-modal-backdrop"} role="presentation">
        <section className={`modal-panel action-modal sheet-${size} task-sheet-modal finance-sheet-modal`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={closeSheet}>
            <X size={20} />
          </button>
          <div className="modal-head">
            <div>
              <h2 className="section-title" id={titleId}>{title}</h2>
            </div>
          </div>
          <div className="modal-body">
            {children}
          </div>
          {footer ? <div className="modal-submit-row modal-footer">{footer}</div> : null}
        </section>
      </div>
    </ModalPortal>
  );
}
