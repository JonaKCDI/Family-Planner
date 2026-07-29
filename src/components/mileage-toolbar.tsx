"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Funnel, Search, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";

export type MileageToolbarParams = {
  car?: string | null;
  month?: string | null;
  year?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  view?: string | null;
};

type MileageToolbarProps = {
  params: MileageToolbarParams;
  selectedMonth: { year: number; month: string } | null;
  filterYear: string;
  years: number[];
  monthOptions: { value: string; label: string }[];
  resultCount: number;
  activeFilterCount: number;
};

const SearchCloseContext = createContext<() => void>(() => {});

export function MileageToolbar({
  params,
  selectedMonth,
  filterYear,
  years,
  monthOptions,
  resultCount,
  activeFilterCount
}: MileageToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(params.q));
  const [filterOpen, setFilterOpen] = useState(false);
  const resetHref = buildMileageHref(params, { q: undefined, from: undefined, to: undefined, month: undefined, year: undefined });

  return (
    <div className="task-toolbar mileage-toolbar" aria-label="Autowerkzeuge">
      <SearchDisclosure label="Tankstopps durchsuchen" expanded={searchOpen} onExpandedChange={setSearchOpen} className="task-search mileage-search">
        <form className="task-inline-search mileage-inline-search" action="/kilometer">
          <MileageHiddenFields params={params} exclude={["q"]} />
          <SearchCloseControl href={params.q ? buildMileageHref(params, { q: undefined }) : undefined} />
          <label>
            <span>Tankstopps durchsuchen</span>
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Bemerkung oder Kilometerstand ..." autoFocus />
          </label>
          <button className="button secondary" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>Suchen</span>
          </button>
        </form>
      </SearchDisclosure>

      <button className="icon-button task-filter-button mileage-filter-button" type="button" aria-label="Kilometer filtern" title="Kilometer filtern" onClick={() => setFilterOpen(true)}>
        <Funnel size={18} aria-hidden="true" />
        {activeFilterCount > 0 ? <span className="task-filter-count">{activeFilterCount}</span> : null}
      </button>

      <BottomSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Kilometer filtern"
        footer={(
          <>
            <a className="button secondary" href={resetHref}>Zurücksetzen</a>
            <button className="button" type="submit" form="mileage-filter-form">{resultCount} Tankstopps anzeigen</button>
          </>
        )}
      >
        <form id="mileage-filter-form" action="/kilometer" className="form form-grid expense-filter-form mileage-filter-form" method="get">
          <MileageHiddenFields params={params} exclude={["from", "to", "month", "year"]} />
          <fieldset className="fieldset full-span compact-fieldset period-picker-fieldset">
            <legend>Monat/Jahr</legend>
            <div className="period-select-row">
              <label>
                Monat
                <select name="month" defaultValue={selectedMonth?.month ?? ""}>
                  <option value="">Kein Monatsfilter</option>
                  {monthOptions.map((month) => <option value={month.value} key={month.value}>{month.label}</option>)}
                </select>
              </label>
              <label>
                Jahr
                <select name="year" defaultValue={filterYear}>
                  {years.map((year) => <option value={year} key={year}>{year}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="fieldset full-span compact-fieldset">
            <legend>Zeitraum optional eingrenzen</legend>
            <div className="form-grid">
              <label>Von<input name="from" type="date" defaultValue={params.from ?? ""} /></label>
              <label>Bis<input name="to" type="date" defaultValue={params.to ?? ""} /></label>
            </div>
          </fieldset>
          <label className="full-span">Suche<input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Bemerkung oder Kilometerstand ..." /></label>
        </form>
      </BottomSheet>
    </div>
  );
}

function MileageHiddenFields({ params, exclude = [] }: { params: MileageToolbarParams; exclude?: string[] }) {
  return (
    <>
      {(["car", "from", "to", "year", "month", "q", "view"] as const).map((key) => {
        const value = params[key];
        if (!value || exclude.includes(key)) return null;
        return <input type="hidden" name={key} value={value} key={key} />;
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
  footer,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const titleId = "mileage-filter-title";

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
        <section className="modal-panel action-modal sheet-large task-sheet-modal mileage-filter-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
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
          <div className="modal-submit-row modal-footer">{footer}</div>
        </section>
      </div>
    </ModalPortal>
  );
}

function buildMileageHref(params: MileageToolbarParams, overrides: MileageToolbarParams) {
  const next = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const key of ["car", "from", "to", "year", "month", "q", "view"] as const) {
    const value = next[key];
    if (value && !(key === "view" && value === "overview")) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/kilometer?${query}` : "/kilometer";
}
