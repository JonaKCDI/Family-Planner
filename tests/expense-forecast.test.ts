import { describe, expect, test } from "vitest";
import { monthlyTotals, monthlySaldo, movingAverage, fitForecast, boxStatistics, recordedMonths, withoutExcludedCategories, forecastReference, forecastOverview, smoothedForecast } from "../src/lib/expense-forecast";

const now = new Date("2026-02-15T12:00:00Z");
describe("expense forecasts", () => {
  test("fits the rolling mean and keeps overview values aligned with both forecast months", () => {
    const entries = Array.from({ length: 11 }, (_, i) => ({ kind: "EXPENSE", date: new Date(Date.UTC(2025, 2 + i, 1)), amountCents: (i + 1) * 100 }));
    // Rolling means: 350, 450, 550, 650, 750, 850; fitted next: 950, 1050.
    expect(smoothedForecast(entries, now)).toEqual([{ month: "2026-02", value: 950 }, { month: "2026-03", value: 1050 }]);
    expect(forecastOverview(entries, [], now, 0).spending).toBe(950);
    expect(forecastOverview(entries, [], now, 1).spending).toBe(1050);
    expect(smoothedForecast(entries.map((e) => ({ ...e, amountCents: 500 })), now).map((p) => p.value)).toEqual([500, 500]);
    expect(smoothedForecast([], now)).toEqual([]);
    expect(smoothedForecast([...entries, { kind: "EXPENSE", date: now, amountCents: 999999 }], now)).toEqual(smoothedForecast(entries, now));
  });
  test("overview excludes both advance payments and reimbursements and derives saldo from rounded averages", () => {
    const entries = [
      { kind: "INCOME", date: "2026-01-01", amountCents: 60001 },
      { kind: "EXPENSE", date: "2026-01-01", amountCents: 120002 },
      { kind: "EXPENSE", date: "2026-01-01", amountCents: 999999, categoryId: "excluded" },
      { kind: "INCOME", date: "2026-01-01", amountCents: 888888, categoryId: "excluded" },
      { kind: "INCOME", date: "2026-02-01", amountCents: 999999 }
    ];
    expect(forecastOverview(entries, [{ id: "excluded", excludeFromForecast: true }], now)).toEqual({ income: 10000, spending: 20000, saldo: -10000, hasHistory: true });
    expect(forecastOverview([], [], now).hasHistory).toBe(false);
    expect(forecastOverview(entries.slice(0, 1), [], now)).toEqual({ income: 10000, spending: 0, saldo: 10000, hasHistory: true });
  });
  test("historical reference ends in December and ignores subsequent actual transactions", () => {
    const entries = [
      { kind: "EXPENSE", date: "2024-07-01", amountCents: 6000 },
      { kind: "EXPENSE", date: "2024-12-31", amountCents: 12000 },
      { kind: "EXPENSE", date: "2025-01-01", amountCents: 999999 },
      { kind: "EXPENSE", date: "2027-01-01", amountCents: 999999 }
    ];
    const reference = forecastReference(entries, "2024", now);
    expect(reference.years).toEqual([2025, 2024]);
    expect(reference.query).toBe("?year=2024");
    expect(reference.date.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    const points = monthlyTotals(entries, reference.date, 12);
    expect(points[0].month).toBe("2024-01");
    expect(points.at(-1)?.month).toBe("2024-12");
    expect(movingAverage(points).at(-1)?.value).toBe(3000);
    expect(fitForecast(points, reference.date).map((p) => p.month)).toEqual(["2025-01", "2025-02"]);
    expect(monthlyTotals(entries, reference.date, 24)[0].month).toBe("2023-01");
    for (const year of [undefined, "current", "2027", "2023", "invalid", ["2024", "2025"]]) {
      expect(forecastReference(entries, year, now)).toMatchObject({ selectedYear: null, date: now, query: "" });
    }
  });
  test("excludes the Auslagen category from spending but retains it in total saldo", () => {
    const categories = [{ id: "advance", name: "Beliebige Kategorie", excludeFromForecast: true }, { id: "food", name: "Auslagen", excludeFromForecast: false }];
    const entries = [
      { kind: "EXPENSE", categoryId: "advance", date: "2026-01-01", amountCents: 50000 },
      { kind: "EXPENSE", categoryId: "food", date: "2026-01-02", amountCents: 10000 },
      { kind: "INCOME", categoryId: "advance", date: "2026-01-03", amountCents: 30000 },
      { kind: "EXPENSE", categoryId: null, date: "2026-01-04", amountCents: 2000 }
    ];
    expect(monthlyTotals(withoutExcludedCategories(entries, categories), now, 1)[0].value).toBe(12000);
    expect(monthlySaldo(entries, now, 1)[0].value).toBe(-32000);
    expect(withoutExcludedCategories(entries, [])).toEqual(entries);
    expect(entries).toHaveLength(4);
  });
  test("monthly saldo includes every expense and income and preserves deficits", () => {
    const entries = [
      { kind: "INCOME", date: "2025-12-01", amountCents: 20000 },
      { kind: "EXPENSE", date: "2025-12-02", amountCents: 30000 },
      { kind: "INCOME", date: "2026-01-02", amountCents: 5000 },
      { kind: "EXPENSE", date: "2026-02-02", amountCents: 99999 }
    ];
    expect(monthlySaldo(entries, now, 3)).toEqual([
      { month: "2025-11", value: 0 }, { month: "2025-12", value: -10000 }, { month: "2026-01", value: 5000 }
    ]);
  });
  test("fills calendar gaps and excludes income, current and future months across a year boundary", () => {
    const entries = [
      { kind: "EXPENSE", date: "2025-12-31", amountCents: 600 },
      { kind: "INCOME", date: "2026-01-01", amountCents: 999 },
      { kind: "EXPENSE", date: "2026-02-01", amountCents: 999 },
      { kind: "EXPENSE", date: "2027-01-01", amountCents: 999 }
    ];
    const points = monthlyTotals(entries, now, 6);
    expect(points.map((p) => p.month)).toEqual(["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
    expect(movingAverage(points).at(-1)?.value).toBe(100);
    expect(recordedMonths(entries, now)).toBe(2);
  });
  test("rolling average advances its six-month window", () => {
    const points = Array.from({ length: 7 }, (_, i) => ({ month: String(i), value: (i + 1) * 100 }));
    expect(movingAverage(points).map((p) => p.value)).toEqual([null, null, null, null, null, 350, 450]);
  });
  test("fits a known linear trend and clips negative predictions", () => {
    const points = Array.from({ length: 12 }, (_, i) => ({ month: String(i), value: (i + 1) * 100 }));
    expect(fitForecast(points, now)).toEqual([{ month: "2026-02", value: 1300 }, { month: "2026-03", value: 1400 }]);
    expect(fitForecast(points.map((p) => ({ ...p, value: 1300 - p.value })), now).map((p) => p.value)).toEqual([0, 0]);
    expect(fitForecast([], now)).toEqual([]);
  });
  test("retains outliers by month and handles zero IQR", () => {
    const points = Array.from({ length: 24 }, (_, i) => ({ month: String(i), value: i === 23 ? 10000 : 100 }));
    expect(boxStatistics(points)).toEqual({ q1: 100, median: 100, q3: 100, low: 100, high: 100, outliers: [{ month: "23", value: 10000 }] });
    expect(boxStatistics([])).toBeNull();
    expect(boxStatistics(points.map((p) => ({ ...p, value: 0 })))?.outliers).toEqual([]);
  });
  test("interpolates quartiles and places whiskers on actual observations", () => {
    const points = [0, 100, 200, 300].map((value) => ({ month: String(value), value }));
    expect(boxStatistics(points)).toMatchObject({ q1: 75, median: 150, q3: 225, low: 0, high: 300 });
    expect(recordedMonths([], now)).toBe(0);
  });
});

