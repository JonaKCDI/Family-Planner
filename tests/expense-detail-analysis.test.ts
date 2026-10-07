import { describe, expect, test } from "vitest";
import { analysisGranularity, buildAnalysisPeriods, buildAnalysisHref, buildAnalysisBackHref, analysisEntryParams } from "../src/lib/expense-detail-analysis";
import { explicitExpensePeriod, getExpenseRange } from "../src/lib/expense-range";
import { filterExpenseAssignments } from "../src/lib/expense-filters";
import { buildCategoryRows, buildLabelRows } from "../src/lib/expense-analytics";
import { filterFamilyExpenses, getFamilyExpenseRange } from "../src/lib/family-finance-filters";

describe("calendar detail analysis", () => {
  test.each([
    ["2026-01-01", "2026-04-01", "week"],
    ["2026-01-01", "2026-04-02", "month"],
    ["2023-01-01", "2026-01-01", "month"],
    ["2023-01-01", "2026-01-02", "year"],
    ["2024-02-29", "2027-02-28", "month"],
    ["2026-01-31", "2026-04-30", "week"]
  ])("%s to exclusive %s uses %s", (from, end, unit) => {
    expect(analysisGranularity(new Date(from), new Date(end))).toBe(unit);
  });

  test("clips Monday-based weeks at both edges and includes zero weeks without netting income", () => {
    const range = getExpenseRange({ from: "2024-02-28", to: "2024-03-12" });
    const entries = [
      { date: "2024-02-27", kind: "EXPENSE", amountCents: 9999 },
      { date: "2024-02-29", kind: "EXPENSE", amountCents: 1234 },
      { date: "2024-03-03", kind: "INCOME", amountCents: 500 },
      { date: "2024-03-12", kind: "EXPENSE", amountCents: 200 },
      { date: "2024-03-13", kind: "EXPENSE", amountCents: 9999 }
    ];
    const { periods } = buildAnalysisPeriods(entries, range);
    expect(periods.map(p => [p.from, p.to, p.spending, p.income, p.partial])).toEqual([
      ["2024-02-28", "2024-03-03", 1234, 500, true],
      ["2024-03-04", "2024-03-10", 0, 0, false],
      ["2024-03-11", "2024-03-12", 200, 0, true]
    ]);
    expect(periods.reduce((sum, p) => sum + p.count, 0)).toBe(2);
  });

  test("does not truncate a three-year monthly series to twelve periods", () => {
    const { periods, granularity } = buildAnalysisPeriods([], getExpenseRange({ from: "2023-01-01", to: "2025-12-31" }));
    expect(granularity).toBe("month");
    expect(periods).toHaveLength(36);
    expect(periods.every(p => p.spending === 0 && !p.partial)).toBe(true);
  });

  test("clips yearly intervals and a week across New Year", () => {
    const years = buildAnalysisPeriods([], getExpenseRange({ from: "2021-06-15", to: "2025-02-10" })).periods;
    expect(years).toHaveLength(5);
    expect(years[0]).toMatchObject({ from: "2021-06-15", to: "2021-12-31", partial: true });
    expect(years.at(-1)).toMatchObject({ from: "2025-01-01", to: "2025-02-10", partial: true });
    expect(buildAnalysisPeriods([], getExpenseRange({ from: "2025-12-29", to: "2026-01-04" })).periods).toHaveLength(1);
  });

  test("freezes implicit month before adding the category and restores original month navigation", () => {
    const original = { month: "2026-09", label: ["holiday", "refund"], paymentMethod: "Karte", q: "Reise", sort: "amount-desc" };
    const context = explicitExpensePeriod(original, getExpenseRange(original));
    const detail = new URL(buildAnalysisHref(context, "category", "travel", original), "https://local.test");
    const params = Object.fromEntries(detail.searchParams);
    expect(detail.searchParams.get("from")).toBe("2026-09-01");
    expect(detail.searchParams.getAll("label")).toEqual(["holiday", "refund"]);
    const back = new URL(buildAnalysisBackHref(params, "category"), "https://local.test");
    expect(back.pathname).toBe("/ausgaben");
    expect(back.searchParams.get("month")).toBe("2026-09");
    expect(back.searchParams.getAll("label")).toEqual(["holiday", "refund"]);
    expect(back.searchParams.has("from")).toBe(false);
    expect(analysisEntryParams(context, "category", "travel")).toMatchObject({ category: "travel", label: ["holiday", "refund"], paymentMethod: "Karte", q: "Reise" });
  });

  test("unassigned and currency filters match exact category scope", () => {
    const entries = [{ categoryId: null, labelId: "l", currency: "EUR" }, { categoryId: "c", labelId: "l", currency: "EUR" }, { categoryId: null, labelId: "l", currency: "USD" }];
    expect(filterExpenseAssignments(entries, { category: "unassigned", label: "l", currency: "EUR" })).toEqual([entries[0]]);
  });

  test("same names with different IDs remain separate", () => {
    const categories = ["a", "b"].map(id => ({ id, name: "Gleich", color: "#16776f", monthlyBudgetCents: 0 }));
    const labels = ["l1", "l2"].map(id => ({ id, name: "Gleich", color: "#16776f", budgetCents: 0 }));
    const entries = categories.map((category, i) => ({ kind: "EXPENSE" as const, date: "2026-09-01", amountCents: 100 * (i + 1), category, label: labels[i] }));
    expect(buildCategoryRows(entries, categories, 300, false).map(r => [r.id, r.spending])).toEqual([["b", 200], ["a", 100]]);
    expect(buildLabelRows(entries, labels).map(r => [r.id, r.spending])).toEqual([["l2", 200], ["l1", 100]]);
  });

  test("family open-ended ranges and period links retain person, currency and assignments", () => {
    const entries = ["2024-01-05", "2026-09-12"].map(date => ({ date: new Date(date), currency: "EUR", amountCents: 1250, categoryId: "c", labelId: "l", person: { id: "u", name: "Anna" }, category: { name: "Food" }, label: { name: "Home" }, description: "Market", store: "", paymentMethod: "Karte" }));
    const params = { bereich: "familie", from: "2025-01-01", person: "u", label: "l", currency: "EUR" };
    const context = explicitExpensePeriod(params, getFamilyExpenseRange(entries, params));
    const scoped = filterFamilyExpenses(entries, analysisEntryParams(context, "category", "c"));
    expect(scoped).toEqual([entries[1]]);
    expect(context.to).toBe("2026-09-12");
    expect(filterFamilyExpenses(entries, params)).toEqual(scoped);
  });
});
