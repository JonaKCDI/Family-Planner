import { describe, expect, test } from "vitest";
import { budgetForRange, buildCategoryRows, buildLabelRows } from "../src/lib/expense-analytics";

const range = (mode: "month" | "year" | "custom", from: string, to: string) => ({
  mode,
  from: new Date(`${from}T00:00:00.000Z`),
  to: new Date(`${to}T23:59:59.999Z`)
});

describe("budget cadence", () => {
  test("converts monthly and yearly budgets to month and year windows", () => {
    expect(budgetForRange(12_000, "MONTHLY", range("month", "2026-02-01", "2026-02-28"))).toBe(12_000);
    expect(budgetForRange(120_000, "YEARLY", range("month", "2026-02-01", "2026-02-28"))).toBe(10_000);
    expect(budgetForRange(12_000, "MONTHLY", range("year", "2026-01-01", "2026-12-31"))).toBe(144_000);
    expect(budgetForRange(120_000, "YEARLY", range("year", "2026-01-01", "2026-12-31"))).toBe(120_000);
  });

  test("prorates monthly budgets by selected days across months", () => {
    expect(budgetForRange(10_000, "MONTHLY", range("custom", "2026-01-15", "2026-02-14"))).toBe(10_484);
  });

  test("prorates yearly budgets using each calendar year's day count", () => {
    expect(budgetForRange(36_600, "YEARLY", range("custom", "2024-02-29", "2024-02-29"))).toBe(100);
    expect(budgetForRange(36_500, "YEARLY", range("custom", "2023-12-31", "2024-01-01"))).toBe(200);
  });

  test("shows lifetime label use against an all-time budget in a custom window", () => {
    const label = { id: "label-1", name: "Reise", color: "#16776f", budgetCents: 10_000, budgetPeriod: "ALL_TIME" as const, lastUsedAt: new Date("2026-02-01T00:00:00Z") };
    const selected = [{ kind: "EXPENSE" as const, amountCents: 3_000, date: new Date("2026-02-01T00:00:00Z"), label }];
    const history = [
      ...selected,
      { kind: "EXPENSE" as const, amountCents: 7_000, date: new Date("2025-03-01T00:00:00Z"), label },
      { kind: "INCOME" as const, amountCents: 1_000, date: new Date("2025-04-01T00:00:00Z"), label }
    ];
    const [row] = buildLabelRows(selected, [label], range("custom", "2026-02-01", "2026-02-28"), history);
    expect(row).toMatchObject({ spending: 3_000, budget: 10_000, budgetConsumption: 9_000, remaining: 1_000, budgetUsage: 90 });
  });

  test("hides recurring label budgets in custom windows but keeps all-time budgets", () => {
    const selected = [{ kind: "EXPENSE" as const, amountCents: 1_000, date: new Date("2026-02-01T00:00:00Z"), label: { id: "monthly", name: "Monat", color: "#16776f", budgetCents: 5_000, budgetPeriod: "MONTHLY" as const } }];
    const [row] = buildLabelRows(selected, [{ ...selected[0].label, lastUsedAt: new Date("2026-02-01T00:00:00Z") }], range("custom", "2026-02-01", "2026-02-28"), selected);
    expect(row.budget).toBe(0);
  });

  test("uses each category cadence for selected-window budget rows", () => {
    const categories = [
      { id: "month", name: "Monat", color: "#16776f", monthlyBudgetCents: 10_000, budgetPeriod: "MONTHLY" as const },
      { id: "year", name: "Jahr", color: "#2e6fea", monthlyBudgetCents: 120_000, budgetPeriod: "YEARLY" as const }
    ];
    const rows = buildCategoryRows([], categories, 0, range("month", "2026-02-01", "2026-02-28"));
    expect(rows.map((row) => row.budget)).toEqual([10_000, 10_000]);
  });

  test("reads cadence fields directly from persisted category and label records", () => {
    const categories = [
      { id: "year", name: "Jahr", color: "#16776f", monthlyBudgetCents: 120_000, budgetCadence: "YEARLY" as const }
    ];
    expect(buildCategoryRows([], categories, 0, range("month", "2026-02-01", "2026-02-28"))[0].budget).toBe(10_000);

    const label = { id: "annual", name: "Jährlich", color: "#16776f", budgetCents: 120_000, budgetCadence: "YEARLY" as const, lastUsedAt: new Date("2026-02-01T00:00:00Z") };
    const entry = { kind: "EXPENSE" as const, amountCents: 1_000, date: new Date("2026-02-01T00:00:00Z"), label };
    expect(buildLabelRows([entry], [label], range("month", "2026-02-01", "2026-02-28"), [entry])[0].budget).toBe(10_000);
  });
});
