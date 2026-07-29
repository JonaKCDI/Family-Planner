import type { ExpenseFilterParams } from "@/lib/expense-filter-url";

export type ExpenseFilterEntry = {
  kind: "EXPENSE" | "INCOME";
  paymentMethod: string;
  contractId: string | null;
  fuelEntryId: string | null;
  recurringTransactionId: string | null;
  generatedByContract: boolean;
  generatedByFuelEntry: boolean;
  generatedByRecurringTransaction: boolean;
};

export function filterExpenseFacets<T extends ExpenseFilterEntry>(entries: T[], params: Pick<ExpenseFilterParams, "kind" | "paymentMethod" | "source">) {
  const kind = normalizeKind(params.kind);
  const paymentMethods = normalizeList(params.paymentMethod);
  const sources = normalizeList(params.source).filter(isExpenseSource);

  return entries
    .filter((entry) => !kind || entry.kind === kind)
    .filter((entry) => paymentMethods.length === 0 || paymentMethods.includes(entry.paymentMethod))
    .filter((entry) => sources.length === 0 || sources.some((source) => matchesSource(entry, source)));
}

export function expenseSource(entry: ExpenseFilterEntry): "manual" | "contract" | "fuel" | "recurring" {
  if (entry.fuelEntryId || entry.generatedByFuelEntry) return "fuel";
  if (entry.recurringTransactionId || entry.generatedByRecurringTransaction) return "recurring";
  if (entry.contractId || entry.generatedByContract) return "contract";
  return "manual";
}

export function sourceLabel(source: ReturnType<typeof expenseSource>) {
  if (source === "contract") return "Vertrag";
  if (source === "fuel") return "Tankstopp";
  if (source === "recurring") return "Serie";
  return "Manuell";
}

export function normalizeList(value: string | string[] | null | undefined) {
  return [...new Set((Array.isArray(value) ? value : [value])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean))];
}

function normalizeKind(value: ExpenseFilterParams["kind"]) {
  if (value === "expense") return "EXPENSE";
  if (value === "income") return "INCOME";
  return null;
}

function isExpenseSource(value: string): value is ReturnType<typeof expenseSource> {
  return value === "manual" || value === "contract" || value === "fuel" || value === "recurring";
}

function matchesSource(entry: ExpenseFilterEntry, source: ReturnType<typeof expenseSource>) {
  return expenseSource(entry) === source;
}
