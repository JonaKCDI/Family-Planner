import { describe, expect, test } from "vitest";
import { isImportantTask, taskRank, taskUrgency } from "../src/lib/tasks";

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

function relativeDate(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}
