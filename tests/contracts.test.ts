import { describe, expect, test } from "vitest";
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

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
