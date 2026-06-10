import { describe, expect, test } from "vitest";
import {
  defaultRecurringTaskLeadTimeDays,
  getNextRecurringTaskDateAfter,
  getRecurringTaskIntervalLabel,
  getRecurringTaskGenerationDecision,
  isImportantTask,
  taskRank,
  taskUrgency
} from "../src/lib/tasks";

describe("task importance", () => {
  test("marks overdue and due-today tasks as important regardless of priority", () => {
    expect(isImportantTask({
      status: "OPEN",
      priority: "LOW",
      dueDate: relativeDate(-1)
    })).toBe(true);

    expect(isImportantTask({
      status: "OPEN",
      priority: "LOW",
      dueDate: relativeDate(0)
    })).toBe(true);
  });

  test("keeps distant high-priority work out of the dashboard important bucket", () => {
    expect(isImportantTask({
      status: "OPEN",
      priority: "HIGH",
      dueDate: relativeDate(30)
    })).toBe(false);
  });

  test("treats urgent tasks and active near-deadline work as important", () => {
    expect(isImportantTask({
      status: "OPEN",
      priority: "URGENT",
      dueDate: null
    })).toBe(true);

    expect(isImportantTask({
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: relativeDate(7)
    })).toBe(true);
  });

  test("never promotes completed or archived tasks", () => {
    expect(isImportantTask({
      status: "DONE",
      priority: "URGENT",
      dueDate: relativeDate(-3)
    })).toBe(false);

    expect(taskRank({
      status: "ARCHIVED",
      priority: "URGENT",
      dueDate: relativeDate(-3)
    })).toBeLessThan(0);
  });

  test("returns user-facing urgency labels from the same shared rule set", () => {
    expect(taskUrgency({
      status: "OPEN",
      priority: "LOW",
      dueDate: relativeDate(-1)
    })).toMatchObject({ label: "Überfällig", chipClass: "danger-chip" });

    expect(taskUrgency({
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: null
    })).toMatchObject({ label: "In Arbeit", chipClass: "calm-chip" });
  });
});

describe("recurring task planning", () => {
  test("uses smart default lead times", () => {
    expect(defaultRecurringTaskLeadTimeDays(1, "DAY")).toBe(0);
    expect(defaultRecurringTaskLeadTimeDays(2, "DAY")).toBe(0);
    expect(defaultRecurringTaskLeadTimeDays(7, "DAY")).toBe(2);
    expect(defaultRecurringTaskLeadTimeDays(1, "MONTH")).toBe(7);
    expect(defaultRecurringTaskLeadTimeDays(1, "YEAR")).toBe(30);
  });

  test("uses friendly German labels for common flexible rhythms", () => {
    expect(getRecurringTaskIntervalLabel({ intervalCount: 7, intervalUnit: "DAY" })).toBe("Wöchentlich");
    expect(getRecurringTaskIntervalLabel({ intervalCount: 14, intervalUnit: "DAY" })).toBe("Alle 2 Wochen");
    expect(getRecurringTaskIntervalLabel({ intervalCount: 3, intervalUnit: "MONTH" })).toBe("Vierteljährlich");
    expect(getRecurringTaskIntervalLabel({ intervalCount: 6, intervalUnit: "MONTH" })).toBe("Halbjährlich");
  });

  test("generates only when a daily or every-2-days task is due", () => {
    expect(getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-06-10"),
      intervalCount: 1,
      intervalUnit: "DAY",
      leadTimeDays: 0
    }, utcDate("2026-06-10"))).toMatchObject({
      shouldGenerate: true,
      dueDate: utcDate("2026-06-10"),
      nextDueDate: utcDate("2026-06-11")
    });

    expect(getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-06-10"),
      nextDueDate: utcDate("2026-06-12"),
      intervalCount: 2,
      intervalUnit: "DAY",
      leadTimeDays: 0
    }, utcDate("2026-06-11"))).toMatchObject({
      shouldGenerate: false,
      nextDueDate: utcDate("2026-06-12")
    });
  });

  test("creates monthly work inside the lead window and clamps month-end dates", () => {
    const beforeWindow = getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-01-31"),
      nextDueDate: utcDate("2026-02-28"),
      intervalCount: 1,
      intervalUnit: "MONTH",
      leadTimeDays: 7
    }, utcDate("2026-02-20"));

    expect(beforeWindow.shouldGenerate).toBe(false);
    expect(beforeWindow.nextDueDate).toEqual(utcDate("2026-02-28"));

    expect(getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-01-31"),
      nextDueDate: utcDate("2026-02-28"),
      intervalCount: 1,
      intervalUnit: "MONTH",
      leadTimeDays: 7
    }, utcDate("2026-02-21"))).toMatchObject({
      shouldGenerate: true,
      dueDate: utcDate("2026-02-28"),
      nextDueDate: utcDate("2026-03-31")
    });
  });

  test("handles yearly leap-day schedules from the original anchor date", () => {
    expect(getNextRecurringTaskDateAfter({
      startDate: utcDate("2024-02-29"),
      intervalCount: 1,
      intervalUnit: "YEAR",
      leadTimeDays: 30
    }, utcDate("2024-02-29"))).toEqual(utcDate("2025-02-28"));

    expect(getNextRecurringTaskDateAfter({
      startDate: utcDate("2024-02-29"),
      intervalCount: 1,
      intervalUnit: "YEAR",
      leadTimeDays: 30
    }, utcDate("2027-02-28"))).toEqual(utcDate("2028-02-29"));
  });

  test("does not generate paused, archived, or ended plans", () => {
    expect(getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-06-10"),
      intervalCount: 1,
      intervalUnit: "DAY",
      leadTimeDays: 0,
      status: "PAUSED"
    }, utcDate("2026-06-10")).shouldGenerate).toBe(false);

    expect(getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-06-10"),
      intervalCount: 1,
      intervalUnit: "DAY",
      leadTimeDays: 0,
      status: "ARCHIVED"
    }, utcDate("2026-06-10")).shouldGenerate).toBe(false);

    expect(getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-01-01"),
      endDate: utcDate("2026-03-01"),
      intervalCount: 1,
      intervalUnit: "MONTH",
      leadTimeDays: 7
    }, utcDate("2026-06-10"))).toMatchObject({
      shouldGenerate: false,
      nextDueDate: null
    });
  });

  test("advances stale plans to the nearest relevant occurrence instead of backfilling all missed dates", () => {
    expect(getRecurringTaskGenerationDecision({
      startDate: utcDate("2026-01-01"),
      nextDueDate: utcDate("2026-01-01"),
      intervalCount: 1,
      intervalUnit: "MONTH",
      leadTimeDays: 7
    }, utcDate("2026-06-10"))).toMatchObject({
      shouldGenerate: true,
      dueDate: utcDate("2026-06-01"),
      nextDueDate: utcDate("2026-07-01")
    });
  });
});

function relativeDate(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
