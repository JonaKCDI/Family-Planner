import { describe, expect, test } from "vitest";
import { buildExpensePlanningAnalysis, type PlanningExpense, type PlanningRule, type PlanningTreatment } from "@/lib/expense-planning-analysis";

const food = { id: "cat_food", name: "Restaurant", color: "#16776f", icon: "utensils" };
const rent = { id: "cat_rent", name: "Wohnen", color: "#2f6fed", icon: "home" };
const misc = { id: "cat_misc", name: "Sonstiges", color: "#6b6f76", icon: "tag" };

describe("expense planning analysis", () => {
  test("uses robust category values instead of distorted averages", () => {
    const entries = [
      ...monthlyCategory("user_a", food, [16000, 18500, 17200, 61000, 15500, 19000, 62000], "2026-01"),
      ...monthlyIncome("user_a", [320000, 320000, 320000, 320000, 320000, 320000, 320000], "2026-01")
    ];

    const analysis = buildExpensePlanningAnalysis({
      entries,
      categories: [food],
      referenceDate: new Date("2026-07-31"),
      months: 7,
      displayYear: 2026
    });

    const row = analysis.categoryRows[0];
    expect(row.medianCents).toBe(18500);
    expect(row.planMonthlyCents).toBeLessThan(26000);
    expect(row.grossCents).toBe(209200);
    expect(row.specialEffectCents).toBeGreaterThan(70000);
    expect(analysis.summary.plannedSavingsCents).toBeGreaterThan(250000);
  });

  test("keeps categories with little history conservative", () => {
    const entries = [
      expense("user_a", misc, "2026-06-10", 70000, "Fahrradladen"),
      expense("user_a", misc, "2026-07-10", 90000, "Fahrradladen")
    ];

    const analysis = buildExpensePlanningAnalysis({
      entries,
      categories: [misc],
      referenceDate: new Date("2026-07-31"),
      months: 6,
      displayYear: 2026
    });

    expect(analysis.categoryRows[0]).toMatchObject({
      activeMonths: 2,
      grossCents: 160000,
      plannedCents: 160000,
      specialEffectCents: 0
    });
    expect(analysis.categoryRows[0].confidence).toBeLessThanOrEqual(40);
    expect(analysis.summary.reviewNeededCents).toBe(160000);
    expect(analysis.summary.monthlyReserveCents).toBe(0);
  });

  test("confirmed reimbursements change normalized income even without keyword text", () => {
    const extraIncomeId = "user_a-income-2026-07-15";
    const treatments: PlanningTreatment[] = [{
      expenseId: extraIncomeId,
      treatment: "REIMBURSEMENT"
    }];
    const entries = [
      income("user_a", "2026-07-28", 300000, "Gehalt"),
      income("user_a", "2026-07-15", 120000, "Abrechnung Projekt")
    ];

    const analysis = buildExpensePlanningAnalysis({
      entries,
      categories: [],
      treatments,
      referenceDate: new Date("2026-07-31"),
      months: 1,
      displayYear: 2026
    });

    expect(analysis.summary.normalIncomeCents).toBe(300000);
    expect(analysis.monthlyRows[0]).toMatchObject({
      incomeCents: 420000,
      normalIncomeCents: 300000
    });
  });

  test("detects stable recurring expenses as fixed costs", () => {
    const entries = [
      expense("user_a", rent, "2026-01-01", 95000, "Vermieter"),
      expense("user_a", rent, "2026-02-01", 95000, "Vermieter"),
      expense("user_a", rent, "2026-03-01", 95000, "Vermieter"),
      expense("user_a", rent, "2026-04-01", 95000, "Vermieter")
    ];

    const analysis = buildExpensePlanningAnalysis({
      entries,
      categories: [rent],
      referenceDate: new Date("2026-04-30"),
      months: 4,
      displayYear: 2026
    });

    expect(analysis.summary.fixedCostCents).toBe(95000);
    expect(analysis.categoryRows[0].plannedCents).toBe(380000);
  });

  test("adjusts the plan upward after a persistent new level", () => {
    const entries = monthlyCategory("user_a", food, [12000, 12500, 11800, 12200, 12100, 11900, 12300, 28000, 28500, 29000], "2025-10");

    const analysis = buildExpensePlanningAnalysis({
      entries,
      categories: [food],
      referenceDate: new Date("2026-07-31"),
      months: 10,
      displayYear: 2026
    });

    expect(analysis.categoryRows[0].planMonthlyCents).toBeGreaterThan(14000);
    expect(analysis.categoryRows[0].planMonthlyCents).toBeLessThanOrEqual(25000);
  });

  test("private learned rules only affect the matching user", () => {
    const rules: PlanningRule[] = [{
      ownerUserId: "user_a",
      patternType: "STORE",
      patternValue: "hotel beispiel",
      treatment: "SPECIAL_EFFECT"
    }];
    const entries = [
      expense("user_a", misc, "2026-07-02", 30000, "Hotel Beispiel"),
      expense("user_b", misc, "2026-07-02", 30000, "Hotel Beispiel")
    ];

    const analysis = buildExpensePlanningAnalysis({
      entries,
      categories: [misc],
      rules,
      referenceDate: new Date("2026-07-31"),
      months: 3,
      displayYear: 2026
    });

    expect(analysis.summary.grossSpendingCents).toBe(60000);
    expect(analysis.summary.plannedSpendingCents).toBe(30000);
  });
});

function monthlyCategory(ownerUserId: string, category: typeof food, values: number[], startMonth: string) {
  const [year, month] = startMonth.split("-").map(Number);
  return values.map((amount, index) => {
    const date = new Date(year, month - 1 + index, 10);
    return expense(ownerUserId, category, date.toISOString().slice(0, 10), amount, category.name);
  });
}

function monthlyIncome(ownerUserId: string, values: number[], startMonth: string) {
  const [year, month] = startMonth.split("-").map(Number);
  return values.map((amount, index) => {
    const date = new Date(year, month - 1 + index, 28);
    return income(ownerUserId, date.toISOString().slice(0, 10), amount, "Gehalt");
  });
}

function expense(ownerUserId: string, category: typeof food, date: string, amountCents: number, store: string): PlanningExpense {
  return {
    id: `${ownerUserId}-${category.id}-${date}-${amountCents}-${store}`,
    ownerUserId,
    kind: "EXPENSE",
    amountCents,
    date: new Date(`${date}T00:00:00.000Z`),
    store,
    description: store,
    paymentMethod: "Karte",
    categoryId: category.id,
    category
  };
}

function income(ownerUserId: string, date: string, amountCents: number, description: string): PlanningExpense {
  return {
    id: `${ownerUserId}-income-${date}`,
    ownerUserId,
    kind: "INCOME",
    amountCents,
    date: new Date(`${date}T00:00:00.000Z`),
    store: "Arbeitgeber",
    description,
    paymentMethod: "Überweisung",
    categoryId: null,
    category: null
  };
}
