export const expenseSortOptions = [
  { value: "date-desc", label: "Datum: neueste zuerst" },
  { value: "date-asc", label: "Datum: älteste zuerst" },
  { value: "amount-desc", label: "Betrag: hoch bis niedrig" },
  { value: "amount-asc", label: "Betrag: niedrig bis hoch" },
  { value: "category-asc", label: "Kategorie: A bis Z" },
  { value: "category-desc", label: "Kategorie: Z bis A" },
  { value: "category-frequency-desc", label: "Kategorie: häufigste zuerst" },
  { value: "category-frequency-asc", label: "Kategorie: seltenste zuerst" }
] as const;

export type ExpenseSortKey = typeof expenseSortOptions[number]["value"];

type SortableExpenseEntry = {
  id: string;
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  date: Date | string;
  createdAt?: Date | string;
  category?: { name: string } | null;
};

const expenseSortValues = new Set<string>(expenseSortOptions.map((option) => option.value));

export function isExpenseSortKey(value: string | null | undefined): value is ExpenseSortKey {
  return Boolean(value && expenseSortValues.has(value));
}

export function getExpenseSortKey(value: string | null | undefined): ExpenseSortKey {
  return isExpenseSortKey(value) ? value : "date-desc";
}

export function sortExpenseEntries<T extends SortableExpenseEntry>(entries: T[], sort: string | null | undefined) {
  const sortKey = getExpenseSortKey(sort);
  const categoryCounts = sortKey.startsWith("category-frequency") ? buildCategoryCounts(entries) : new Map<string, number>();

  return [...entries].sort((a, b) => {
    switch (sortKey) {
      case "date-asc":
        return compareDate(a.date, b.date) || fallbackCompare(a, b);
      case "amount-desc":
        return signedAmountCents(b) - signedAmountCents(a) || fallbackCompare(a, b);
      case "amount-asc":
        return signedAmountCents(a) - signedAmountCents(b) || fallbackCompare(a, b);
      case "category-asc":
        return compareCategory(a, b) || fallbackCompare(a, b);
      case "category-desc":
        return compareCategory(b, a) || fallbackCompare(a, b);
      case "category-frequency-desc":
        return (categoryCounts.get(categoryName(b)) ?? 0) - (categoryCounts.get(categoryName(a)) ?? 0) || compareCategory(a, b) || fallbackCompare(a, b);
      case "category-frequency-asc":
        return (categoryCounts.get(categoryName(a)) ?? 0) - (categoryCounts.get(categoryName(b)) ?? 0) || compareCategory(a, b) || fallbackCompare(a, b);
      case "date-desc":
      default:
        return compareDate(b.date, a.date) || fallbackCompare(a, b);
    }
  });
}

function buildCategoryCounts(entries: SortableExpenseEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const name = categoryName(entry);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function compareCategory(a: SortableExpenseEntry, b: SortableExpenseEntry) {
  return categoryName(a).localeCompare(categoryName(b), "de-DE", { sensitivity: "base" });
}

function signedAmountCents(entry: SortableExpenseEntry) {
  return entry.kind === "INCOME" ? entry.amountCents : -entry.amountCents;
}

function categoryName(entry: SortableExpenseEntry) {
  return entry.category?.name?.trim() || "Ohne Kategorie";
}

function fallbackCompare(a: SortableExpenseEntry, b: SortableExpenseEntry) {
  return compareDate(b.date, a.date) || compareDate(b.createdAt, a.createdAt) || a.id.localeCompare(b.id);
}

function compareDate(a: Date | string | undefined, b: Date | string | undefined) {
  return dateTime(a) - dateTime(b);
}

function dateTime(value: Date | string | undefined) {
  return value ? new Date(value).getTime() : 0;
}
