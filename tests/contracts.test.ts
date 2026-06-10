import { describe, expect, test } from "vitest";
import { getDueContractExpenseDates, getDueRecurringTransactionDates, getPricePhaseForDate, paymentDayForContract } from "../src/lib/contract-auto-expenses";
import { getContractNextCancellationDate, getNextAnnualCancellationDate, parseAnnualCancellationDeadline, resolveContractCancellationSchedule, toAnnualCancellationInputValue } from "../src/lib/contracts";

describe("annual cancellation deadlines", () => {
  test("keeps this year's deadline when the latest cancellation date is today", () => {
    expect(toLocalDateKey(getNextAnnualCancellationDate(5, 16, new Date(2026, 4, 16)))).toBe("2026-05-16");
  });

  test("rolls yearly deadlines into the next year after the date has passed", () => {
    expect(toLocalDateKey(getNextAnnualCancellationDate(5, 15, new Date(2026, 4, 16)))).toBe("2027-05-15");
  });

  test("parses a date input into reusable month and day values", () => {
    expect(parseAnnualCancellationDeadline("2026-11-30", new Date(2026, 4, 16))).toMatchObject({
      month: 11,
      day: 30
    });
    expect(toAnnualCancellationInputValue(11, 30, null)).toMatch(/^\d{4}-11-30$/);
  });

  test("falls back to end date minus notice period when no annual deadline is set", () => {
    const schedule = resolveContractCancellationSchedule({
      annualDeadline: "",
      endDate: "2026-12-31",
      noticeDays: 30
    });

    expect(schedule.deadlineMonth).toBeNull();
    expect(schedule.deadlineDay).toBeNull();
    expect(schedule.nextDate ? toLocalDateKey(schedule.nextDate) : null).toBe("2026-12-01");
  });

  test("does not invent a cancellation date from notice days alone", () => {
    expect(resolveContractCancellationSchedule({
      annualDeadline: "",
      endDate: "",
      noticeDays: 30
    }).nextDate).toBeNull();
  });

  test("rolls a monthly phone contract to the next actionable month-end deadline", () => {
    const schedule = resolveContractCancellationSchedule({
      annualDeadline: "",
      endDate: "2026-05-31",
      noticeDays: 20,
      autoRenewal: true,
      renewalInterval: "MONTHLY",
      referenceDate: new Date(2026, 4, 16)
    });

    expect(schedule.renewalAnchorDay).toBe(31);
    expect(schedule.nextDate ? toLocalDateKey(schedule.nextDate) : null).toBe("2026-06-10");
  });

  test("recomputes auto-renewal deadlines at render time", () => {
    const nextDate = getContractNextCancellationDate({
      endDate: new Date(2026, 4, 31),
      cancellationNoticeDays: 20,
      cancellationDeadlineMonth: null,
      cancellationDeadlineDay: null,
      autoRenewal: true,
      renewalInterval: "MONTHLY",
      renewalAnchorDay: 31,
      nextCancellationDate: new Date(2026, 4, 11)
    }, new Date(2026, 4, 16));

    expect(nextDate ? toLocalDateKey(nextDate) : null).toBe("2026-06-10");
  });
});

describe("automatic contract expenses", () => {
  test("generates monthly due dates up to today", () => {
    const dates = getDueContractExpenseDates({
      id: "contract-1",
      familyId: "family-1",
      ownerUserId: "user-1",
      provider: "Mobilfunk",
      contractType: "Handy",
      costCents: 2999,
      currency: "EUR",
      billingInterval: "MONTHLY",
      startDate: new Date(Date.UTC(2026, 0, 15)),
      endDate: null,
      status: "ACTIVE",
      autoRenewal: true,
      autoCreateExpenses: true,
      expensePaymentDay: 15
    }, new Date(Date.UTC(2026, 2, 16)));

    expect(dates.map(toLocalDateKey)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  test("uses the last valid month day for high payment days", () => {
    const dates = getDueContractExpenseDates({
      id: "contract-1",
      familyId: "family-1",
      ownerUserId: "user-1",
      provider: "Abo",
      contractType: "Monatsende",
      costCents: 999,
      currency: "EUR",
      billingInterval: "MONTHLY",
      startDate: new Date(Date.UTC(2026, 0, 31)),
      endDate: null,
      status: "ACTIVE",
      autoRenewal: true,
      autoCreateExpenses: true,
      expensePaymentDay: 31
    }, new Date(Date.UTC(2026, 2, 31)));

    expect(dates.map(toLocalDateKey)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  test("does not generate for inactive or disabled contracts", () => {
    const base = {
      id: "contract-1",
      familyId: "family-1",
      ownerUserId: "user-1",
      provider: "Abo",
      contractType: "Test",
      costCents: 999,
      currency: "EUR",
      billingInterval: "MONTHLY" as const,
      startDate: new Date(Date.UTC(2026, 0, 1)),
      endDate: null,
      autoRenewal: true,
      expensePaymentDay: 1
    };

    expect(getDueContractExpenseDates({ ...base, status: "ACTIVE", autoCreateExpenses: false }, new Date(Date.UTC(2026, 0, 2)))).toEqual([]);
    expect(getDueContractExpenseDates({ ...base, status: "CANCELLED", autoCreateExpenses: true }, new Date(Date.UTC(2026, 0, 2)))).toEqual([]);
  });

  test("falls back to the contract start day as payment day", () => {
    expect(paymentDayForContract({
      startDate: new Date(Date.UTC(2026, 4, 20)),
      expensePaymentDay: null
    })).toBe(20);
  });

  test("selects the price phase that is valid for the due date", () => {
    const phases = [
      { amountCents: 2000, currency: "EUR", billingInterval: "MONTHLY" as const, validFrom: new Date(Date.UTC(2026, 0, 1)), validTo: new Date(Date.UTC(2026, 5, 30)) },
      { amountCents: 2500, currency: "EUR", billingInterval: "MONTHLY" as const, validFrom: new Date(Date.UTC(2026, 6, 1)), validTo: null }
    ];

    expect(getPricePhaseForDate(phases, new Date(Date.UTC(2026, 5, 1)))?.amountCents).toBe(2000);
    expect(getPricePhaseForDate(phases, new Date(Date.UTC(2026, 6, 1)))?.amountCents).toBe(2500);
    expect(getPricePhaseForDate(phases, new Date(Date.UTC(2025, 11, 31)))).toBeNull();
  });

  test("generates recurring transaction dates and respects pause and soft delete", () => {
    const base = {
      id: "series-1",
      familyId: "family-1",
      ownerUserId: "user-1",
      kind: "EXPENSE" as const,
      title: "Miete",
      description: "",
      paymentMethod: "Lastschrift",
      store: "Vermieter",
      categoryId: null,
      labelId: null,
      startDate: new Date(Date.UTC(2026, 0, 31)),
      endDate: null,
      status: "ACTIVE" as const,
      deletedAt: null,
      pricePhases: [{ amountCents: 80000, currency: "EUR", billingInterval: "MONTHLY" as const, validFrom: new Date(Date.UTC(2026, 0, 31)), validTo: null }]
    };

    expect(getDueRecurringTransactionDates(base, new Date(Date.UTC(2026, 2, 31))).map(toLocalDateKey)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(getDueRecurringTransactionDates({ ...base, status: "PAUSED" }, new Date(Date.UTC(2026, 2, 31)))).toEqual([]);
    expect(getDueRecurringTransactionDates({ ...base, deletedAt: new Date(Date.UTC(2026, 1, 1)) }, new Date(Date.UTC(2026, 2, 31)))).toEqual([]);
  });
});

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
