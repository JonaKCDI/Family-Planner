"use client";

import { useId, useMemo, useState } from "react";

type FilterMultiSelectOption = {
  id: string;
  name: string;
};

type FilterMultiSelectProps = {
  name: string;
  label: string;
  options: FilterMultiSelectOption[];
  defaultValue?: string | string[] | null;
  emptyLabel: string;
  placeholder: string;
};

export function FilterMultiSelect({ name, label, options, defaultValue, emptyLabel, placeholder }: FilterMultiSelectProps) {
  const listId = useId();
  const initialSelection = useMemo(() => uniqueValues(defaultValue).filter((id) => options.some((option) => option.id === id)), [defaultValue, options]);
  const [selectedIds, setSelectedIds] = useState(initialSelection);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOptions = options.filter((option) => selectedIds.includes(option.id));
  const filteredOptions = options.filter((option) => normalize(option.name).includes(normalize(query)));

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="filter-multi-select">
      <span className="filter-multi-label">{label}</span>
      {selectedIds.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      <div className="filter-multi-control">
        <button
          aria-controls={listId}
          aria-expanded={open}
          className="filter-multi-trigger"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selectedOptions.length ? `${selectedOptions.length} ausgewählt` : emptyLabel}</span>
          <span aria-hidden="true">⌄</span>
        </button>
        {selectedIds.length ? <button className="filter-multi-clear" type="button" onClick={() => setSelectedIds([])} aria-label={`${label} zurücksetzen`} title={`${label} zurücksetzen`}>×</button> : null}
      </div>
      {selectedOptions.length ? (
        <div className="filter-multi-chips" aria-label={`Ausgewählte ${label}`}>
          {selectedOptions.map((option) => (
            <button type="button" key={option.id} onClick={() => toggle(option.id)}>
              {option.name}<span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="filter-multi-options" id={listId} role="listbox" aria-multiselectable="true">
          <input autoFocus value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={placeholder} />
          <div className="filter-multi-options-list">
            {filteredOptions.length === 0 ? <span className="combobox-empty">Keine Treffer</span> : null}
            {filteredOptions.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <button className={selected ? "selected" : ""} type="button" role="option" aria-selected={selected} key={option.id} onClick={() => toggle(option.id)}>
                  <span>{option.name}</span>
                  <span aria-hidden="true">{selected ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function uniqueValues(value: string | string[] | null | undefined) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}
