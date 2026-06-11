import { describe, expect, test } from "vitest";
import { matchesExpenseSearch } from "@/lib/expense-search";

const expense = {
  amountCents: 500000,
  currency: "EUR",
  kind: "EXPENSE" as const,
  date: new Date(Date.UTC(2026, 5, 9)),
  description: "Tanken",
  store: "Shell",
  paymentMethod: "Karte",
  category: { name: "Mobilität" },
  label: null,
  contract: null,
  recurringTransaction: null,
  fuelEntry: null
};

describe("expense search", () => {
  test("matches amount in common German and compact formats", () => {
    expect(matchesExpenseSearch(expense, "5.000,00 €")).toBe(true);
    expect(matchesExpenseSearch(expense, "5000")).toBe(true);
    expect(matchesExpenseSearch(expense, "5000,00")).toBe(true);
    expect(matchesExpenseSearch(expense, "5000.00")).toBe(true);
    expect(matchesExpenseSearch(expense, "-5000")).toBe(true);
  });

  test("still matches textual fields", () => {
    expect(matchesExpenseSearch(expense, "shell")).toBe(true);
    expect(matchesExpenseSearch(expense, "mobilität")).toBe(true);
    expect(matchesExpenseSearch(expense, "urlaub")).toBe(false);
  });

  test("matches visible date and linked document information", () => {
    expect(matchesExpenseSearch(expense, "09.06.2026")).toBe(true);
    expect(matchesExpenseSearch(expense, "2026-06-09")).toBe(true);
    expect(matchesExpenseSearch(expense, "rechnung shell juni", {
      documents: [{ title: "Rechnung Shell Juni", url: "https://drive.google.com/beleg-shell" }]
    })).toBe(true);
    expect(matchesExpenseSearch(expense, "beleg-shell", {
      documents: [{ title: "Rechnung Shell Juni", url: "https://drive.google.com/beleg-shell" }]
    })).toBe(true);
  });

  test("matches visible automation and fuel metadata without internal ids", () => {
    const generatedFuelExpense = {
      ...expense,
      generatedByFuelEntry: true,
      fuelEntry: { odometerKm: 100000, car: { name: "Seat Leon" } },
      recurringTransaction: { title: "Monatsmiete" },
      generatedByContract: true,
      contract: { provider: "Vodafone", contractType: "Handy" }
    };

    expect(matchesExpenseSearch(generatedFuelExpense, "tankstopp")).toBe(true);
    expect(matchesExpenseSearch(generatedFuelExpense, "seat leon")).toBe(true);
    expect(matchesExpenseSearch(generatedFuelExpense, "100.000 km")).toBe(true);
    expect(matchesExpenseSearch(generatedFuelExpense, "serie: monatsmiete")).toBe(true);
    expect(matchesExpenseSearch(generatedFuelExpense, "auto-vertrag")).toBe(true);
    expect(matchesExpenseSearch(generatedFuelExpense, "vodafone")).toBe(true);
    expect(matchesExpenseSearch(generatedFuelExpense, "expense-id")).toBe(false);
  });
});
