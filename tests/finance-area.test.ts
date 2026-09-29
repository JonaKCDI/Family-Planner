import { expect, test } from "vitest";
import { financeAreaHref } from "../src/lib/finance-area";
import { normalizeFamilyFinanceParams } from "../src/lib/family-finance-params";

test("area switch keeps period and resets area-specific filters", () => {
  const href = financeAreaHref("/ausgaben", "month=2026-09&view=labels&person=a&category=private&label=secret", "familie");
  expect(href).toContain("month=2026-09");
  expect(href).toContain("view=labels");
  expect(href).toContain("bereich=familie");
  expect(href).not.toContain("private");
  expect(href).not.toContain("person=");
});
test("family-only setup and detail IDs never lead to a broken personal page", () => {
  expect(financeAreaHref("/ausgaben/setup/zuordnungen", "", "persoenlich")).toBe("/ausgaben/setup?bereich=persoenlich");
  expect(financeAreaHref("/ausgaben/analyse/kategorie/shared-id", "month=2026-09", "persoenlich")).toBe("/ausgaben?month=2026-09&bereich=persoenlich&view=categories");
});
test("untrusted family GET parameters have safe scalar and date defaults", () => {
  expect(normalizeFamilyFinanceParams({ q: ["first", "second"] as unknown as string, currency: "invalid", month: "2026-99", from: "2026-02-30" })).toMatchObject({ q: "first", currency: "EUR", view: "overview" });
  expect(normalizeFamilyFinanceParams({ month: "2026-09", year: "2025", from: "2026-01-01" })).not.toHaveProperty("year");
});
