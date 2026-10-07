"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { ArrowLeft, ChevronRight, Funnel, Search, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";

export type ContractToolbarParams = {
  q?: string;
  view?: string;
  status?: string;
  scope?: string;
  autoExpense?: string;
  renewal?: string;
  attention?: string;
  sort?: string;
};

type ContractToolbarProps = {
  params: ContractToolbarParams;
  activeFilterCount: number;
  resultCount: number;
};

const SearchCloseContext = createContext<() => void>(() => {});

export function ContractToolbar({ params, activeFilterCount, resultCount }: ContractToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(params.q));
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPanel, setFilterPanel] = useState<"main" | "more">("main");

  return (
    <div className="task-toolbar contract-toolbar" aria-label="Vertragswerkzeuge">
      <SearchDisclosure label="Verträge durchsuchen" expanded={searchOpen} onExpandedChange={setSearchOpen} className="task-search contract-search">
        <form className="task-inline-search contract-inline-search" action="/vertraege">
          <ContractHiddenFields params={params} exclude={["q"]} />
          <SearchCloseControl href={params.q ? buildContractHref(params, { q: undefined }) : undefined} />
          <label>
            <span>Verträge durchsuchen</span>
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Anbieter, Art, Notiz, Person ..." autoFocus />
          </label>
          <button className="button secondary" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>Suchen</span>
          </button>
        </form>
      </SearchDisclosure>

      <IconButton className="task-filter-button contract-filter-button" label="Verträge filtern" onClick={() => setFilterOpen(true)}>
        <Funnel size={18} aria-hidden="true" />
        {activeFilterCount > 0 ? <span className="task-filter-count">{activeFilterCount}</span> : null}
      </IconButton>

      <BottomSheet
        open={filterOpen}
        onOpenChange={(nextOpen) => {
          setFilterOpen(nextOpen);
          if (!nextOpen) setFilterPanel("main");
        }}
        title="Verträge filtern"
        size="medium"
        footer={(
          <>
            <a className="button secondary" href="/vertraege">Zurücksetzen</a>
            <button className="button" type="submit" form="contract-filter-form">{resultCount} Verträge anzeigen</button>
          </>
        )}
      >
        <form id="contract-filter-form" className="task-filter-form contract-filter-form" action="/vertraege">
          <ContractHiddenFields params={params} exclude={["status", "scope", "autoExpense", "renewal", "attention", "sort"]} />
          {filterPanel === "more" ? (
            <div className="task-create-subhead full-span contract-filter-subhead">
              <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={() => setFilterPanel("main")}>
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
              <strong>Weitere Filter</strong>
              <span aria-hidden="true" />
            </div>
          ) : null}
          <div className="form-grid task-filter-layout contract-filter-main" hidden={filterPanel !== "main"}>
            <fieldset className="fieldset">
              <legend>Status</legend>
              <label>
                <span>Status</span>
                <select name="status" defaultValue={params.status ?? ""}>
                  <option value="">Alle Status</option>
                  <option value="ACTIVE">Aktiv</option>
                  <option value="DRAFT">Entwurf</option>
                  <option value="CANCELLED">Gekündigt</option>
                  <option value="EXPIRED">Ausgelaufen</option>
                  <option value="ENDED">Beendet</option>
                </select>
              </label>
            </fieldset>
            <fieldset className="fieldset">
              <legend>Fristen</legend>
              <label>
                <span>Kündigungsfrist</span>
                <select name="attention" defaultValue={params.attention ?? ""}>
                  <option value="">Alle Fristen</option>
                  <option value="soon">Bald kündbar</option>
                  <option value="overdue">Überfällig</option>
                  <option value="none">Ohne Frist</option>
                </select>
              </label>
            </fieldset>
            <button className="flow-link contract-more-filters-link" type="button" onClick={() => setFilterPanel("more")}>
              <span>Weitere Filter</span>
              <small>Sichtbarkeit, Automatik und Sortierung</small>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="form-grid task-filter-layout contract-filter-more" hidden={filterPanel !== "more"}>
            <fieldset className="fieldset">
              <legend>Sichtbarkeit</legend>
              <label>
                <span>Sichtbarkeit</span>
                <select name="scope" defaultValue={params.scope ?? ""}>
                  <option value="">Familie und privat</option>
                  <option value="FAMILY">Familie</option>
                  <option value="PRIVATE">Privat</option>
                </select>
              </label>
            </fieldset>
            <fieldset className="fieldset">
              <legend>Automatik</legend>
              <label>
                <span>Auto-Ausgaben</span>
                <select name="autoExpense" defaultValue={params.autoExpense ?? ""}>
                  <option value="">Alle Verträge</option>
                  <option value="yes">Mit Auto-Ausgabe</option>
                  <option value="no">Ohne Auto-Ausgabe</option>
                </select>
              </label>
              <label>
                <span>Verlängerung</span>
                <select name="renewal" defaultValue={params.renewal ?? ""}>
                  <option value="">Alle Laufzeiten</option>
                  <option value="yes">Automatische Verlängerung</option>
                  <option value="no">Ohne automatische Verlängerung</option>
                </select>
              </label>
            </fieldset>
            <fieldset className="fieldset">
              <legend>Sortierung</legend>
              <label>
                <span>Sortieren nach</span>
                <select name="sort" defaultValue={params.sort ?? "deadline"}>
                  <option value="deadline">Nächste Frist</option>
                  <option value="cost-desc">Kosten absteigend</option>
                  <option value="provider">Anbieter A-Z</option>
                </select>
              </label>
            </fieldset>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

function ContractHiddenFields({ params, exclude = [] }: { params: ContractToolbarParams; exclude?: string[] }) {
  return (
    <>
      {Object.entries(params).map(([key, value]) => (
        value && !exclude.includes(key) ? <input type="hidden" name={key} value={value} key={key} /> : null
      ))}
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
  const titleId = "contract-filter-title";

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
        <section className={`modal-panel action-modal sheet-${size} task-sheet-modal contract-sheet-modal`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
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

function buildContractHref(params: ContractToolbarParams, next: Partial<ContractToolbarParams>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...next })) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/vertraege?${query}` : "/vertraege";
}
