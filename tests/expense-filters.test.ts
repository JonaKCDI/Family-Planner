import { describe, expect, test } from "vitest";
import { expenseSource, filterExpenseFacets, type ExpenseFilterEntry } from "@/lib/expense-filters";

const entries = [
  entry({ kind: "EXPENSE", paymentMethod: "Karte" }),
  entry({ kind: "INCOME", paymentMethod: "Überweisung" }),
  entry({ kind: "EXPENSE", paymentMethod: "Lastschrift", contractId: "contract_1", generatedByContract: true }),
  entry({ kind: "EXPENSE", paymentMethod: "Karte", fuelEntryId: "fuel_1", generatedByFuelEntry: true }),
  entry({ kind: "EXPENSE", paymentMethod: "Lastschrift", recurringTransactionId: "series_1", generatedByRecurringTransaction: true })
];

describe("expense facet filters", () => {
  test("filters by visible kind", () => {
    expect(filterExpenseFacets(entries, { kind: "income" })).toHaveLength(1);
    expect(filterExpenseFacets(entries, { kind: "expense" })).toHaveLength(4);
  });

  test("filters by payment method and source", () => {
    expect(filterExpenseFacets(entries, { paymentMethod: ["Karte"], source: ["manual"] })).toEqual([entries[0]]);
    expect(filterExpenseFacets(entries, { source: ["contract", "recurring"] })).toEqual([entries[2], entries[4]]);
  });

  test("classifies generated sources in priority order", () => {
    expect(expenseSource(entries[0])).toBe("manual");
    expect(expenseSource(entries[2])).toBe("contract");
    expect(expenseSource(entries[3])).toBe("fuel");
    expect(expenseSource(entries[4])).toBe("recurring");
  });
});

function entry(overrides: Partial<ExpenseFilterEntry>): ExpenseFilterEntry {
  return {
    kind: "EXPENSE",
    paymentMethod: "Karte",
    contractId: null,
    fuelEntryId: null,
    recurringTransactionId: null,
    generatedByContract: false,
    generatedByFuelEntry: false,
    generatedByRecurringTransaction: false,
    ...overrides
  };
}
