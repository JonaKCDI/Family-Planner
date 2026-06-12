import { describe, expect, test } from "vitest";
import { sortExpenseEntries } from "@/lib/expense-sorting";

const entries = [
  entry("1", "EXPENSE", 1200, "2026-06-10", "Wohnen"),
  entry("2", "EXPENSE", 300, "2026-06-12", "Mobilität"),
  entry("3", "INCOME", 4500, "2026-06-11", "Wohnen"),
  entry("4", "EXPENSE", 900, "2026-06-09", "Freizeit"),
  entry("5", "INCOME", 700, "2026-06-08", "Mobilität"),
  entry("6", "EXPENSE", 150, "2026-06-07", null)
];

describe("expense sorting", () => {
  test("sorts by visible signed amount in both directions", () => {
    expect(sortExpenseEntries(entries, "amount-desc").map((item) => item.id)).toEqual(["3", "5", "6", "2", "4", "1"]);
    expect(sortExpenseEntries(entries, "amount-asc").map((item) => item.id)).toEqual(["1", "4", "2", "6", "5", "3"]);
  });

  test("sorts by date in both directions", () => {
    expect(sortExpenseEntries(entries, "date-desc").map((item) => item.id)).toEqual(["2", "3", "1", "4", "5", "6"]);
    expect(sortExpenseEntries(entries, "date-asc").map((item) => item.id)).toEqual(["6", "5", "4", "1", "3", "2"]);
  });

  test("sorts by category alphabet and frequency", () => {
    expect(sortExpenseEntries(entries, "category-asc").map((item) => item.id)).toEqual(["4", "2", "5", "6", "3", "1"]);
    expect(sortExpenseEntries(entries, "category-frequency-desc").map((item) => item.id)).toEqual(["2", "5", "3", "1", "4", "6"]);
    expect(sortExpenseEntries(entries, "category-frequency-asc").map((item) => item.id)).toEqual(["4", "6", "2", "5", "3", "1"]);
  });
});

function entry(id: string, kind: "EXPENSE" | "INCOME", amountCents: number, date: string, categoryName: string | null) {
  return {
    id,
    kind,
    amountCents,
    date: new Date(`${date}T12:00:00.000Z`),
    createdAt: new Date(`${date}T13:00:00.000Z`),
    category: categoryName ? { name: categoryName } : null
  };
}
