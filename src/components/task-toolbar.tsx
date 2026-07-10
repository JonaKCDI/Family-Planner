"use client";

import { useState } from "react";
import { ListFilter, Search, X } from "lucide-react";
import {
  BottomSheet,
  FilterGroup,
  FilterSheetLayout,
  IconButton,
  SearchDisclosure
} from "@/components/ui-system";

type TaskToolbarProps = {
  params: {
    q?: string;
    view?: string;
    priority?: string;
    person?: string;
    recurring?: string;
    sort?: string;
  };
  members: { id: string; userId: string; user: { name: string } }[];
  activeFilterCount: number;
};

export function TaskToolbar({ params, members, activeFilterCount }: TaskToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(params.q));
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="task-toolbar" aria-label="Aufgabenwerkzeuge">
      <SearchDisclosure label="Suche" expanded={searchOpen} onExpandedChange={setSearchOpen} className="task-search">
        <form className="task-inline-search" action="/aufgaben">
          <TaskHiddenFields params={params} exclude={["q"]} />
          <a className="task-search-close" href={buildClearHref(params, ["q"])} aria-label="Suche schließen" title="Suche schließen">
            <X size={17} aria-hidden="true" />
          </a>
          <label>
            <span>Aufgaben durchsuchen</span>
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Titel, Beschreibung, Person ..." />
          </label>
          <button className="button secondary" type="submit">
            <Search size={16} aria-hidden="true" />
            <span>Suchen</span>
          </button>
        </form>
      </SearchDisclosure>

      <IconButton className="task-filter-button" label="Aufgaben filtern" onClick={() => setFilterOpen(true)}>
        <ListFilter size={18} aria-hidden="true" />
        {activeFilterCount > 0 ? <span className="task-filter-count">{activeFilterCount}</span> : null}
      </IconButton>

      <BottomSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Aufgaben filtern"
        description="Bestehende Ansicht, Priorität, Personen, Wiederholung und Sortierung."
        footer={(
          <>
            <a className="button secondary" href="/aufgaben">Zurücksetzen</a>
            <button className="button" type="submit" form="task-filter-form">Anwenden</button>
          </>
        )}
      >
        <form id="task-filter-form" className="task-filter-form" action="/aufgaben">
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          <FilterSheetLayout>
            <FilterGroup title="Status">
              <label>
                <span>Ansicht</span>
                <select name="view" defaultValue={params.view ?? "active"}>
                  <option value="active">Aktiv</option>
                  <option value="planned">Geplant</option>
                  <option value="done">Erledigt</option>
                  <option value="all">Alle</option>
                </select>
              </label>
            </FilterGroup>
            <FilterGroup title="Priorität">
              <label>
                <span>Priorität</span>
                <select name="priority" defaultValue={params.priority ?? ""}>
                  <option value="">Alle Prioritäten</option>
                  <option value="URGENT">Dringend</option>
                  <option value="HIGH">Hoch</option>
                  <option value="MEDIUM">Mittel</option>
                  <option value="LOW">Niedrig</option>
                </select>
              </label>
            </FilterGroup>
            <FilterGroup title="Beteiligte Personen">
              <label>
                <span>Person</span>
                <select name="person" defaultValue={params.person ?? ""}>
                  <option value="">Alle Personen</option>
                  <option value="unassigned">Nicht zugewiesen</option>
                  {members.map((member) => (
                    <option value={member.userId} key={member.id}>{member.user.name}</option>
                  ))}
                </select>
              </label>
            </FilterGroup>
            <FilterGroup title="Wiederholung">
              <label>
                <span>Wiederkehrend</span>
                <select name="recurring" defaultValue={params.recurring ?? ""}>
                  <option value="">Alle Aufgaben</option>
                  <option value="recurring">Aus wiederkehrendem Plan</option>
                </select>
              </label>
            </FilterGroup>
            <FilterGroup title="Sortierung">
              <label>
                <span>Sortieren nach</span>
                <select name="sort" defaultValue={params.sort ?? "importance"}>
                  <option value="importance">Wichtigkeit</option>
                  <option value="date-asc">Datum aufsteigend</option>
                  <option value="date-desc">Datum absteigend</option>
                </select>
              </label>
            </FilterGroup>
          </FilterSheetLayout>
        </form>
      </BottomSheet>
    </div>
  );
}

function TaskHiddenFields({
  params,
  exclude = []
}: {
  params: TaskToolbarProps["params"];
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

function buildClearHref(params: TaskToolbarProps["params"], keys: string[]) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || keys.includes(key)) continue;
    search.set(key, value);
  }
  const query = search.toString();
  return query ? `/aufgaben?${query}` : "/aufgaben";
}
