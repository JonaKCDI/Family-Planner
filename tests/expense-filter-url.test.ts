import { describe, expect, test } from "vitest";
import { addMonthsToMonthKey, buildExpensesHref, buildFilterHref, buildMonthNavigationHref, buildPeriodHref, buildYearNavigationHref, getCanonicalExpensesHref, getMonthKey, getRawExpensesHref } from "@/lib/expense-filter-url";

describe("expense filter URLs", () => {
  test("year clears month and custom dates while preserving active facets", () => {
    expect(buildPeriodHref({
      month: "2026-05",
      from: "2026-05-01",
      to: "2026-05-31",
      q: "kita",
      category: "cat_1",
      label: "label_1"
    }, { year: "2026" })).toBe("/ausgaben?year=2026&label=label_1&category=cat_1&q=kita");
  });

  test("current month clears year and custom dates", () => {
    expect(buildPeriodHref({
      year: "2026",
      from: "2026-01-01",
      to: "2026-12-31",
      q: "bar"
    }, { month: "2026-05" })).toBe("/ausgaben?month=2026-05&q=bar");
  });

  test("custom dates clear year and month", () => {
    expect(buildFilterHref({
      year: "2026",
      month: "2026-05",
      q: "reise"
    }, {
      from: "2026-03-01",
      to: "2026-03-31",
      q: "reise"
    })).toBe("/ausgaben?from=2026-03-01&to=2026-03-31&q=reise");
  });

  test("empty fields are omitted", () => {
    expect(buildFilterHref({
      year: "2026",
      category: "cat_1",
      q: "strom"
    }, {
      from: "",
      to: " ",
      category: "",
      label: undefined,
      q: ""
    })).toBe("/ausgaben?year=2026");
  });

  test("default current month key is explicit and stable for a given date", () => {
    expect(getMonthKey(new Date("2026-05-15T12:00:00.000Z"))).toBe("2026-05");
    expect(buildExpensesHref({}, { month: "2026-05" })).toBe("/ausgaben?month=2026-05");
  });

  test("direct period jump keeps active finance facets", () => {
    expect(buildPeriodHref({
      from: "2026-01-01",
      to: "2026-01-31",
      q: "tanken",
      category: "cat_mobility",
      label: "label_auto"
    }, { month: "2026-12" })).toBe("/ausgaben?month=2026-12&label=label_auto&category=cat_mobility&q=tanken");

    expect(buildPeriodHref({
      month: "2026-12",
      q: "tanken",
      category: "cat_mobility"
    }, { year: "2025" })).toBe("/ausgaben?year=2025&category=cat_mobility&q=tanken");
  });

  test("canonical URL removes impossible period combinations", () => {
    const conflicted = {
      year: "2026",
      month: "2026-05",
      from: "2026-04-01",
      to: "2026-04-30",
      q: "strom"
    };

    expect(getRawExpensesHref(conflicted)).toBe("/ausgaben?from=2026-04-01&to=2026-04-30&year=2026&month=2026-05&q=strom");
    expect(getCanonicalExpensesHref(conflicted)).toBe("/ausgaben?from=2026-04-01&to=2026-04-30&q=strom");
  });

  test("canonical URL cleans native GET form submissions", () => {
    expect(getCanonicalExpensesHref({
      year: "2026",
      month: "",
      from: "",
      to: "",
      category: "",
      label: "label_1",
      q: "supermarkt"
    })).toBe("/ausgaben?year=2026&label=label_1&q=supermarkt");

    expect(getCanonicalExpensesHref({
      year: "2026",
      month: "2026-05",
      from: "2026-02-01",
      to: "",
      category: "cat_1",
      label: "",
      q: ""
    })).toBe("/ausgaben?from=2026-02-01&category=cat_1");
  });

  test("canonical URL combines separate native month and year controls", () => {
    expect(getCanonicalExpensesHref({
      year: "2026",
      month: "01",
      q: "auto"
    })).toBe("/ausgaben?month=2026-01&q=auto");
  });

  test("month navigation crosses year boundaries and keeps active facets", () => {
    expect(addMonthsToMonthKey("2026-01", -1)).toBe("2025-12");
    expect(addMonthsToMonthKey("2026-12", 1)).toBe("2027-01");
    expect(buildMonthNavigationHref({
      month: "2026-12",
      q: "strom",
      category: "cat_1",
      label: "label_1"
    }, "2026-12", 1)).toBe("/ausgaben?month=2027-01&label=label_1&category=cat_1&q=strom");
  });

  test("year navigation keeps active detail filters", () => {
    expect(buildYearNavigationHref({
      year: "2026",
      q: "versicherung",
      category: "cat_1",
      label: "label_1"
    }, 2026, -1)).toBe("/ausgaben?year=2025&label=label_1&category=cat_1&q=versicherung");
  });
});
