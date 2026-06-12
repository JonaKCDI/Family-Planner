"use client";

import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

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
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    return filterOptions(options, inputValue);
  }, [inputValue, options]);
  const visibleOptions = useMemo(() => {
    return required ? filteredOptions : [null, ...filteredOptions];
  }, [filteredOptions, required]);
  const activeOptionId = open && visibleOptions[activeIndex] !== undefined ? optionElementId(fieldId, activeIndex) : undefined;

  function choose(option: SearchableSelectOption | null) {
    setSelectedId(option?.id ?? "");
    setInputValue(option?.name ?? "");
    setActiveIndex(option ? Math.max(visibleOptions.findIndex((item) => item?.id === option.id), 0) : 0);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleInput(value: string) {
    setInputValue(value);
    setOpen(true);
    const exactMatch = options.find((option) => normalize(option.name) === normalize(value));
    setSelectedId(exactMatch?.id ?? "");
    setActiveIndex(-1);
  }

  function handleFocus() {
    setOpen(true);
    setActiveIndex(preferredActiveIndex(filteredOptions, required, selectedId));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => nextActiveIndex(current, visibleOptions.length, 1, firstKeyboardOptionIndex(inputValue, filteredOptions.length, required)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => nextActiveIndex(current, visibleOptions.length, -1));
      return;
    }

    if (event.key === "Home" && open && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && open && visibleOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(visibleOptions.length - 1);
      return;
    }

    if (event.key === "Enter" && open) {
      const activeOption = visibleOptions[activeIndex];
      if (activeOption !== undefined) {
        event.preventDefault();
        choose(activeOption);
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
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
          aria-activedescendant={activeOptionId}
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          className="combobox-input"
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => handleInput(event.currentTarget.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
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
                id={optionElementId(fieldId, 0)}
                className={optionClassName(!selectedId, activeIndex === 0)}
                type="button"
                role="option"
                aria-selected={!selectedId}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(0)}
                onClick={() => choose(null)}
              >
                <span>{emptyLabel}</span>
              </button>
            ) : null}
            {filteredOptions.length === 0 ? <span className="combobox-empty">Keine Treffer</span> : null}
            {filteredOptions.map((option, index) => {
              const itemIndex = required ? index : index + 1;
              return (
              <button
                id={optionElementId(fieldId, itemIndex)}
                className={optionClassName(selectedId === option.id, activeIndex === itemIndex)}
                type="button"
                role="option"
                aria-selected={selectedId === option.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(itemIndex)}
                onClick={() => choose(option)}
                key={option.id}
              >
                <span>{option.name}</span>
                {option.meta ? <small>{option.meta}</small> : null}
              </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function filterOptions(options: SearchableSelectOption[], value: string) {
  const query = normalize(value);
  if (!query) return options;
  return options.filter((option) => normalize(option.name).includes(query));
}

function preferredActiveIndex(options: SearchableSelectOption[], required: boolean, selectedId?: string) {
  if (selectedId) {
    const selectedIndex = options.findIndex((option) => option.id === selectedId);
    if (selectedIndex >= 0) return required ? selectedIndex : selectedIndex + 1;
  }
  if (!required) return 0;
  return options.length > 0 ? 0 : -1;
}

function nextActiveIndex(current: number, length: number, direction: 1 | -1, firstIndex = 0) {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return direction === 1 ? Math.min(firstIndex, length - 1) : length - 1;
  return (current + direction + length) % length;
}

function firstKeyboardOptionIndex(value: string, optionCount: number, required: boolean) {
  return !required && normalize(value) && optionCount > 0 ? 1 : 0;
}

function optionElementId(fieldId: string, index: number) {
  return `${fieldId}-option-${index}`;
}

function optionClassName(selected: boolean, active: boolean) {
  return ["combobox-option", selected ? "selected" : "", active ? "active" : ""].filter(Boolean).join(" ");
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}
