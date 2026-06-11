import { formatDate, formatMoney } from "@/lib/format";

type SearchableExpenseEntry = {
  amountCents: number;
  currency: string;
  kind: "EXPENSE" | "INCOME";
  date: Date | string;
  description: string;
  store: string;
  paymentMethod: string;
  generatedByContract?: boolean;
  generatedByFuelEntry?: boolean;
  generatedByRecurringTransaction?: boolean;
  category?: { name: string } | null;
  label?: { name: string } | null;
  contract?: { provider: string; contractType: string } | null;
  recurringTransaction?: { title: string } | null;
  fuelEntry?: { odometerKm: number; car: { name: string } } | null;
};

type ExpenseSearchContext = {
  documents?: { title: string; url: string }[];
};

export function matchesExpenseSearch(entry: SearchableExpenseEntry, query: string, context: ExpenseSearchContext = {}) {
  const normalizedQuery = normalizeExpenseSearch(query);
  if (!normalizedQuery) return true;

  return expenseSearchValues(entry, context).some((value) => normalizeExpenseSearch(value).includes(normalizedQuery));
}

function expenseSearchValues(entry: SearchableExpenseEntry, context: ExpenseSearchContext) {
  return [
    formatDate(entry.date),
    dateKey(entry.date),
    entry.description,
    entry.store,
    entry.paymentMethod,
    entry.category?.name,
    entry.label?.name,
    entry.contract?.provider,
    entry.contract?.contractType,
    entry.generatedByContract ? "Auto-Vertrag" : "",
    entry.generatedByContract ? "Automatisch aus Vertrag erstellt" : "",
    entry.recurringTransaction?.title,
    entry.recurringTransaction ? `Serie: ${entry.recurringTransaction.title}` : "",
    entry.generatedByRecurringTransaction ? "Serie" : "",
    entry.fuelEntry?.car.name,
    entry.fuelEntry ? `${entry.fuelEntry.odometerKm.toLocaleString("de-DE")} km` : "",
    entry.fuelEntry ? `${entry.fuelEntry.odometerKm} km` : "",
    entry.fuelEntry ? compactAmount(String(entry.fuelEntry.odometerKm)) : "",
    entry.generatedByFuelEntry ? "Automatisch aus Tankstopp erstellt" : "",
    entry.fuelEntry ? "Tankstopp" : "",
    ...(context.documents ?? []).flatMap((document) => [document.title, document.url]),
    entry.kind === "INCOME" ? "einnahme" : "ausgabe",
    entry.currency,
    ...amountSearchValues(entry.amountCents, entry.currency, entry.kind)
  ];
}

function amountSearchValues(amountCents: number, currency: string, kind: SearchableExpenseEntry["kind"]) {
  const sign = kind === "INCOME" ? "+" : "-";
  const absoluteAmount = Math.abs(amountCents);
  const decimal = (absoluteAmount / 100).toFixed(2);
  const decimalDe = decimal.replace(".", ",");
  const wholeEuro = absoluteAmount % 100 === 0 ? String(absoluteAmount / 100) : "";

  return [
    formatMoney(absoluteAmount, currency),
    decimalDe,
    decimal,
    wholeEuro,
    `${sign}${decimalDe}`,
    `${sign}${decimal}`,
    `${sign}${wholeEuro}`,
    compactAmount(decimalDe),
    compactAmount(formatMoney(absoluteAmount, currency))
  ].filter(Boolean);
}

function compactAmount(value: string) {
  return value.replace(/[.\s\u00a0€]/g, "");
}

function dateKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function normalizeExpenseSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s\u00a0]+/g, " ");
}
