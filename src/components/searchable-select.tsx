"use client";

import { useId, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  id: string;
  name: string;
  meta?: string;
};

type SearchableSelectProps = {
  name: string;
  label: string;
  options: SearchableSelectOption[];
  defaultValue?: string | null;
  emptyLabel: string;
  placeholder: string;
  required?: boolean;
};

export function SearchableSelect({
  name,
  label,
  options,
  defaultValue,
  emptyLabel,
  placeholder,
  required = false
}: SearchableSelectProps) {
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const initialOption = options.find((option) => option.id === defaultValue);
  const [selectedId, setSelectedId] = useState(initialOption?.id ?? "");
  const [inputValue, setInputValue] = useState(initialOption?.name ?? "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    const query = normalize(inputValue);
    if (!query) return options;
    return options.filter((option) => normalize(option.name).includes(query));
  }, [inputValue, options]);

  function choose(option: SearchableSelectOption | null) {
    setSelectedId(option?.id ?? "");
    setInputValue(option?.name ?? "");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleInput(value: string) {
    setInputValue(value);
    setOpen(true);
    const exactMatch = options.find((option) => normalize(option.name) === normalize(value));
    setSelectedId(exactMatch?.id ?? "");
  }

  return (
    <label className="combobox-field" htmlFor={fieldId}>
      {label}
      <input type="hidden" name={name} value={selectedId} />
      <div className="combobox-control">
        <input
          id={fieldId}
          ref={inputRef}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          className="combobox-input"
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => handleInput(event.currentTarget.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          role="combobox"
          value={inputValue}
        />
        {inputValue || selectedId ? (
          <button className="combobox-clear" type="button" aria-label={emptyLabel} title={emptyLabel} onClick={() => choose(null)}>
            x
          </button>
        ) : null}
        {open ? (
          <div className="combobox-options" role="listbox" id={listboxId}>
            {!required ? (
              <button
                className={!selectedId ? "combobox-option active" : "combobox-option"}
                type="button"
                role="option"
                aria-selected={!selectedId}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(null)}
              >
                <span>{emptyLabel}</span>
              </button>
            ) : null}
            {filteredOptions.length === 0 ? <span className="combobox-empty">Keine Treffer</span> : null}
            {filteredOptions.map((option) => (
              <button
                className={selectedId === option.id ? "combobox-option active" : "combobox-option"}
                type="button"
                role="option"
                aria-selected={selectedId === option.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                key={option.id}
              >
                <span>{option.name}</span>
                {option.meta ? <small>{option.meta}</small> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}
