import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { attachmentDisposition, safeFilePart } from "../src/lib/file-names";
import { ownedExpenseWhere } from "../src/lib/permissions";
import { parseEuroInputToCents, parseIsoDateTime, parseOptionalIntegerInput, parseRequiredDateInput } from "../src/lib/validation";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    expense: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    task: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    category: { findFirst: vi.fn() },
    expenseLabel: { findFirst: vi.fn() },
    contract: { findFirst: vi.fn() },
    familyMember: { findFirst: vi.fn() }
  }
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/queries", () => ({
  getExpenseLabels: vi.fn(),
  getFamilyMembers: vi.fn(),
  getVisibleCategories: vi.fn(),
  getVisibleContracts: vi.fn(),
  getVisibleExpenses: vi.fn(),
  getVisibleTasks: vi.fn()
}));

describe("input validation hardening", () => {
  test("parses German euro input and rejects invalid amounts", () => {
    expect(parseEuroInputToCents("1.234,56")).toBe(123456);
    expect(() => parseEuroInputToCents("abc")).toThrow("Euro-Betrag");
  });

  test("rejects invalid dates and out-of-range integers", () => {
    expect(parseRequiredDateInput("2026-05-16").toISOString().slice(0, 10)).toBe("2026-05-16");
    expect(() => parseRequiredDateInput("2026-02-31")).toThrow("Datum");
    expect(() => parseIsoDateTime("not-a-date")).toThrow("Datum");
    expect(() => parseOptionalIntegerInput("4000", { min: 0, max: 3650 })).toThrow("höchstens");
  });
  test("sanitizes generated download filenames", () => {
    expect(safeFilePart('Jona "../evil.xlsx')).toBe("Jona-..-evil.xlsx");
    expect(attachmentDisposition('Ausgaben_2026-Jona "../evil.xlsx')).toBe(
      "attachment; filename=\"Ausgaben_2026-Jona-..-evil.xlsx\"; filename*=UTF-8''Ausgaben_2026-Jona-..-evil.xlsx"
    );
  });
});

describe("personal expense ownership", () => {
  test("expense delete filters by owner even for admins", () => {
    expect(ownedExpenseWhere("family_1", "user_1", "expense_1")).toEqual({
      id: "expense_1",
      familyId: "family_1",
      ownerUserId: "user_1"
    });
  });
});

describe("offline sync ownership", () => {
  let applySyncPush: typeof import("../src/lib/sync-server").applySyncPush;
  const session = { family: { id: "family_1" }, user: { id: "user_1" } };
  const changedAt = "2026-05-16T12:00:00.000Z";

  beforeAll(async () => {
    ({ applySyncPush } = await import("../src/lib/sync-server"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.expense.findUnique.mockResolvedValue(null);
    dbMock.expense.findFirst.mockResolvedValue(null);
    dbMock.expense.create.mockImplementation(async ({ data }) => data);
    dbMock.expense.updateMany.mockResolvedValue({ count: 1 });
    dbMock.task.findUnique.mockResolvedValue(null);
    dbMock.task.findFirst.mockResolvedValue(null);
    dbMock.task.create.mockImplementation(async ({ data }) => data);
    dbMock.task.updateMany.mockResolvedValue({ count: 1 });
    dbMock.category.findFirst.mockResolvedValue({ id: "cat_1" });
    dbMock.expenseLabel.findFirst.mockResolvedValue({ id: "label_1" });
    dbMock.contract.findFirst.mockResolvedValue({ id: "contract_1" });
    dbMock.familyMember.findFirst.mockResolvedValue({ userId: "user_2" });
  });

  test("creates a new offline expense local ID for the current user", async () => {
    const result = await applySyncPush(session, {
      changes: [{
        clientMutationId: "mutation_1",
        entity: "expense",
        action: "create",
        localId: "expense_local",
        changedAt,
        data: expenseData()
      }]
    });

    expect(result.results[0]).toMatchObject({ ok: true, id: "expense_local" });
    expect(dbMock.expense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: "expense_local", familyId: "family_1", ownerUserId: "user_1" })
    }));
  });

  test("treats current-user existing expense ID as an idempotent retry", async () => {
    dbMock.expense.findUnique.mockResolvedValue({ familyId: "family_1", ownerUserId: "user_1", updatedAt: new Date("2026-05-16T10:00:00.000Z") });

    const result = await applySyncPush(session, {
      changes: [{
        clientMutationId: "mutation_2",
        entity: "expense",
        action: "create",
        localId: "expense_existing",
        changedAt,
        data: expenseData()
      }]
    });

    expect(result.results[0]).toMatchObject({ ok: true, id: "expense_existing" });
    expect(dbMock.expense.create).not.toHaveBeenCalled();
    expect(dbMock.expense.updateMany).toHaveBeenCalled();
  });

  test("rejects another user's expense ID on offline create", async () => {
    dbMock.expense.findUnique.mockResolvedValue({ familyId: "family_1", ownerUserId: "other_user", updatedAt: new Date("2026-05-16T10:00:00.000Z") });

    const result = await applySyncPush(session, {
      changes: [{
        clientMutationId: "mutation_3",
        entity: "expense",
        action: "create",
        localId: "expense_stolen",
        changedAt,
        data: expenseData()
      }]
    });

    expect(result.results[0]).toMatchObject({ ok: false, entity: "expense" });
    expect(dbMock.expense.create).not.toHaveBeenCalled();
  });

  test("rejects invalid submitted relation IDs", async () => {
    dbMock.category.findFirst.mockResolvedValue(null);

    const result = await applySyncPush(session, {
      changes: [{
        clientMutationId: "mutation_4",
        entity: "expense",
        action: "create",
        localId: "expense_bad_relation",
        changedAt,
        data: expenseData({ categoryId: "cat_other" })
      }]
    });

    expect(result.results[0]).toMatchObject({ ok: false, entity: "expense" });
  });

  test("rejects another user's task ID on offline create", async () => {
    dbMock.task.findUnique.mockResolvedValue({ familyId: "family_1", ownerUserId: "other_user", updatedAt: new Date("2026-05-16T10:00:00.000Z") });

    const result = await applySyncPush(session, {
      changes: [{
        clientMutationId: "mutation_5",
        entity: "task",
        action: "create",
        localId: "task_stolen",
        changedAt,
        data: {
          title: "Test",
          status: "OPEN",
          priority: "MEDIUM",
          dueDate: "2026-05-20",
          scope: "FAMILY",
          assignedToUserId: "user_2"
        }
      }]
    });

    expect(result.results[0]).toMatchObject({ ok: false, entity: "task" });
    expect(dbMock.task.create).not.toHaveBeenCalled();
  });
});

function expenseData(overrides: Record<string, unknown> = {}) {
  return {
    kind: "EXPENSE",
    amountCents: 1299,
    currency: "EUR",
    date: "2026-05-16",
    paymentMethod: "Karte",
    categoryId: null,
    labelId: null,
    contractId: null,
    description: "Offline Test",
    ...overrides
  };
}
