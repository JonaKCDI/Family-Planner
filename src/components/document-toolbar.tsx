"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Funnel, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/modal-portal";

export type DocumentToolbarParams = {
  q?: string;
  tab?: string;
  root?: string;
  path?: string;
};

type DocumentToolbarProps = {
  params: DocumentToolbarParams;
  activeFilterCount: number;
};

type DocumentSummaryItem = {
  count: number;
  href: string;
  label: string;
  tab: "all" | "files" | "links" | "linked";
};

type DocumentSummaryStripProps = {
  items: DocumentSummaryItem[];
  tab: DocumentSummaryItem["tab"];
};

const SearchCloseContext = createContext<() => void>(() => {});
const tabIndexes: Record<DocumentSummaryItem["tab"], number> = {
  all: 0,
  files: 1,
  links: 2,
  linked: 3
};

export function DocumentToolbar({ params, activeFilterCount }: DocumentToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(params.q));
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="document-toolbar" aria-label="Dokumentwerkzeuge">
      <SearchDisclosure label="Suche" expanded={searchOpen} onExpandedChange={setSearchOpen} className="document-search-shell">
        <form className="document-inline-search" action="/dokumente">
          <DocumentHiddenFields params={params} exclude={["q"]} />
          <SearchCloseControl href={params.q ? buildDocumentHref(params, { q: undefined }) : undefined} />
          <label>
            <span>Dokumente durchsuchen</span>
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Titel, Datei, Beschreibung, Bezug ..." autoFocus />
          </label>
          <button className="button secondary" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>Suchen</span>
          </button>
        </form>
      </SearchDisclosure>

      <IconButton className="document-filter-button" label="Dokumente filtern" onClick={() => setFilterOpen(true)}>
        <Funnel size={18} aria-hidden="true" />
        {activeFilterCount > 0 ? <span className="document-filter-count">{activeFilterCount}</span> : null}
      </IconButton>

      <BottomSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Dokumente filtern"
        size="compact"
        footer={(
          <>
            <a className="button secondary" href={buildDocumentHref(params, { tab: undefined })}>Zurücksetzen</a>
            <button className="button" type="submit" form="document-filter-form">Anwenden</button>
          </>
        )}
      >
        <form id="document-filter-form" className="document-filter-form" action="/dokumente">
          <DocumentHiddenFields params={params} exclude={["tab"]} />
          <div className="form-grid document-filter-layout">
            <fieldset className="fieldset">
              <legend>Ansicht</legend>
              <label>
                <span>Dokumenttyp und Bezug</span>
                <select name="tab" defaultValue={params.tab ?? "all"}>
                  <option value="all">Alle Dokumente</option>
                  <option value="files">Lokale Dateien</option>
                  <option value="links">HTTPS-Links</option>
                  <option value="linked">Mit Bezug</option>
                </select>
              </label>
            </fieldset>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

export function DocumentSummaryStrip({ items, tab }: DocumentSummaryStripProps) {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState(tab);
  const [highlightIndex, setHighlightIndex] = useState(() => tabIndexes[tab]);
  const [withoutSlide, setWithoutSlide] = useState(false);

  return (
    <section
      className={`document-summary-strip has-selection ${withoutSlide ? "no-slide" : ""}`}
      style={{ "--document-summary-index": highlightIndex } as React.CSSProperties}
      aria-label="Dokumentansicht"
    >
      {items.map((item) => {
        const active = selectedTab === item.tab;
        return (
          <a
            className={active ? "active" : ""}
            href={item.href}
            key={item.tab}
            onClick={(event) => {
              event.preventDefault();
              if (!active && selectedTab === "all") {
                setWithoutSlide(true);
                window.setTimeout(() => setWithoutSlide(false), 220);
              }
              setSelectedTab(item.tab);
              setHighlightIndex(tabIndexes[item.tab]);
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

function DocumentHiddenFields({
  params,
  exclude = []
}: {
  params: DocumentToolbarParams;
  exclude?: string[];
}) {
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
      className="document-search-close"
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
      <button className="icon-button document-search-toggle" type="button" aria-label={label} title={label} aria-expanded={phase === "open"} onClick={toggleSearch}>
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
        <section className={`modal-panel action-modal sheet-${size} document-sheet-modal`} role="dialog" aria-modal="true" aria-labelledby="document-filter-title">
          <button className="icon-button modal-close-button" type="button" aria-label="Schließen" title="Schließen" onClick={closeSheet}>
            <X size={20} />
          </button>
          <div className="modal-head">
            <div>
              <h2 className="section-title" id="document-filter-title">{title}</h2>
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

function buildDocumentHref(params: DocumentToolbarParams, next: Partial<DocumentToolbarParams>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...next })) {
    if (value && !(key === "tab" && value === "all")) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/dokumente?${query}` : "/dokumente";
}
