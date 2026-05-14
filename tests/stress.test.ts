import { describe, expect, test } from "vitest";
import { buildCategoryRows, buildLabelRows, buildPeriodRows, sumByKind, type AnalyticsExpense } from "../src/lib/expense-analytics";

describe("high volume expense calculations", () => {
  test.each([10_000, 50_000, 100_000])("keeps totals exact for %i rows", (count) => {
    const categories = Array.from({ length: 12 }, (_, index) => ({
      name: `Kategorie ${index + 1}`,
      color: "#16776f",
      monthlyBudgetCents: 100000
    }));
    const labels = Array.from({ length: 8 }, (_, index) => ({
      name: `Projekt ${index + 1}`,
      color: "#2e6fea",
      budgetCents: 250000
    }));
    const rows: AnalyticsExpense[] = Array.from({ length: count }, (_, index) => {
      const kind = index % 7 === 0 ? "INCOME" as const : "EXPENSE" as const;
      return {
        kind,
        amountCents: ((index * 37) % 20000) + 1,
        date: new Date(2026, index % 12, (index % 28) + 1),
        category: categories[index % categories.length],
        label: labels[index % labels.length]
      };
    });

    const expectedIncome = rows.filter((row) => row.kind === "INCOME").reduce((sum, row) => sum + row.amountCents, 0);
    const expectedSpending = rows.filter((row) => row.kind === "EXPENSE").reduce((sum, row) => sum + row.amountCents, 0);
    const periods = buildPeriodRows(rows, categories, "month");
    const categoryRows = buildCategoryRows(rows, categories, expectedSpending, true);
    const labelRows = buildLabelRows(rows, labels);

    expect(sumByKind(rows, "INCOME")).toBe(expectedIncome);
    expect(sumByKind(rows, "EXPENSE")).toBe(expectedSpending);
    expect(periods.reduce((sum, row) => sum + row.income, 0)).toBe(expectedIncome);
    expect(periods.reduce((sum, row) => sum + row.spending, 0)).toBe(expectedSpending);
    expect(categoryRows.reduce((sum, row) => sum + row.amount, 0)).toBe(expectedSpending);
    expect(labelRows.reduce((sum, row) => sum + row.amount, 0)).toBe(expectedSpending);
  });
});
