"use client";

type DocumentRootOption = {
  id: string;
  name: string;
  href: string;
};

export function DocumentRootSelect({ options, selectedId }: { options: DocumentRootOption[]; selectedId: string }) {
  return (
    <select
      className="document-root-select"
      value={selectedId}
      onChange={(event) => {
        const selectedOption = options.find((option) => option.id === event.currentTarget.value);
        if (selectedOption) window.location.href = selectedOption.href;
      }}
      aria-label="Dokumentbereich auswählen"
    >
      {options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
    </select>
  );
}
