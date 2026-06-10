import { z } from "zod";
import { db } from "@/lib/db";
import { getExpenseLabels, getFamilyMembers, getVisibleCategories, getVisibleContracts, getVisibleExpenses, getVisibleTasks } from "@/lib/queries";
import { resolveExpenseCategoryId, resolveExpenseLabelId, resolveTaskAssigneeId, resolveVisibleContractId } from "@/lib/relations";
import { parseIsoDateTime, parseOptionalDateInput, parseRequiredDateInput, parseSyncAmountCents } from "@/lib/validation";

type SyncSession = {
  user: { id: string };
  family: { id: string };
};

const expenseDataSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  amountCents: z.unknown().transform((value) => parseSyncAmountCents(value)),
  currency: z.string().default("EUR"),
  date: z.string(),
  paymentMethod: z.string().default("Nicht angegeben"),
  store: z.string().default(""),
  categoryId: z.string().nullable().optional(),
  labelId: z.string().nullable().optional(),
  contractId: z.string().nullable().optional(),
  description: z.string().default("")
});

const taskDataSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"]).default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().nullable().optional(),
  scope: z.enum(["PRIVATE", "FAMILY"]).default("FAMILY"),
  assignedToUserId: z.string().nullable().optional()
});

const taskPatchSchema = taskDataSchema.partial();

const syncChangeSchema = z.object({
  clientMutationId: z.string(),
  entity: z.enum(["expense", "task"]),
  action: z.enum(["create", "update", "delete"]),
  entityId: z.string().optional(),
  localId: z.string().optional(),
  changedAt: z.string(),
  data: z.unknown().optional()
});

export const pushSchema = z.object({
  changes: z.array(syncChangeSchema).max(100)
});

export async function buildSyncBootstrap(session: SyncSession) {
  const [expenses, tasks, categories, labels, contracts, members] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getFamilyMembers(session.family.id)
  ]);

  return {
    serverTime: new Date().toISOString(),
    expenses: expenses.map(serializeExpense),
    tasks: tasks.map(serializeTask),
    categories,
    labels,
    contracts: contracts.map((contract) => ({
      id: contract.id,
      provider: contract.provider,
      contractType: contract.contractType
    })),
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user.name
    }))
  };
}

export async function buildSyncPull(session: SyncSession, since: string | null) {
  const sinceDate = since ? parseIsoDateTime(since) : new Date(0);
  const [expenses, tasks] = await Promise.all([
    db.expense.findMany({
      where: {
        familyId: session.family.id,
        ownerUserId: session.user.id,
        updatedAt: { gt: sinceDate }
      },
      include: { category: true, label: true, contract: true, recurringTransaction: true, fuelEntry: { include: { car: true } }, owner: true },
      orderBy: { updatedAt: "asc" }
    }),
    db.task.findMany({
      where: {
        familyId: session.family.id,
        updatedAt: { gt: sinceDate },
        OR: [
          { scope: "FAMILY" },
          { ownerUserId: session.user.id },
          { assignedToUserId: session.user.id }
        ]
      },
      include: {
        owner: true,
        assignee: true,
        recurringTask: {
          select: {
            id: true,
            title: true,
            intervalCount: true,
            intervalUnit: true
          }
        }
      },
      orderBy: { updatedAt: "asc" }
    })
  ]);

  return {
    serverTime: new Date().toISOString(),
    expenses: expenses.map(serializeExpense),
    tasks: tasks.map(serializeTask)
  };
}

export async function applySyncPush(session: SyncSession, input: z.infer<typeof pushSchema>) {
  const results = [];
  for (const change of input.changes) {
    try {
      const result = change.entity === "expense"
        ? await applyExpenseChange(session, change)
        : await applyTaskChange(session, change);
      results.push({ clientMutationId: change.clientMutationId, ok: true, entity: change.entity, id: result?.id ?? change.entityId ?? change.localId });
    } catch (error) {
      results.push({
        clientMutationId: change.clientMutationId,
        ok: false,
        entity: change.entity,
        message: error instanceof Error ? error.message : "Unbekannter Sync-Fehler"
      });
    }
  }

  return {
    serverTime: new Date().toISOString(),
    results
  };
}

async function applyExpenseChange(session: SyncSession, change: z.infer<typeof syncChangeSchema>) {
  const id = change.entityId ?? change.localId;
  if (!id) throw new Error("Ausgaben-Sync braucht eine ID.");
  const changedAt = parseIsoDateTime(change.changedAt);
  if (change.action === "delete") {
    const existing = await db.expense.findFirst({ where: { id, familyId: session.family.id, ownerUserId: session.user.id } });
    if (!existing || existing.updatedAt <= changedAt) {
      await db.expense.deleteMany({ where: { id, familyId: session.family.id, ownerUserId: session.user.id } });
    }
    return { id };
  }

  const data = expenseDataSchema.parse(change.data);
  const categoryId = await resolveExpenseCategoryId(session.family.id, session.user.id, data.categoryId || null);
  const labelId = await resolveExpenseLabelId(session.family.id, session.user.id, data.labelId || null);
  const contractId = await resolveVisibleContractId(session.family.id, session.user.id, data.contractId || null);
  const persisted = {
    familyId: session.family.id,
    ownerUserId: session.user.id,
    kind: data.kind,
    amountCents: data.amountCents,
    currency: data.currency,
    date: parseRequiredDateInput(data.date),
    paymentMethod: data.paymentMethod || "Nicht angegeben",
    store: data.store || "",
    categoryId,
    labelId,
    contractId,
    description: data.description,
    scope: "PRIVATE" as const
  };

  if (change.action === "create") {
    const existing = await db.expense.findUnique({ where: { id }, select: { familyId: true, ownerUserId: true, updatedAt: true } });
    if (existing && (existing.familyId !== session.family.id || existing.ownerUserId !== session.user.id)) {
      throw new Error("Diese Offline-Ausgabe darf nicht überschrieben werden.");
    }
    if (!existing) return db.expense.create({ data: { id, ...persisted } });
    if (existing.updatedAt <= changedAt) {
      await db.expense.updateMany({ where: { id, familyId: session.family.id, ownerUserId: session.user.id }, data: persisted });
    }
    return { id };
  }

  const existing = await db.expense.findFirst({ where: { id, familyId: session.family.id, ownerUserId: session.user.id } });
  if (!existing) {
    const conflicting = await db.expense.findUnique({ where: { id }, select: { id: true } });
    if (conflicting) throw new Error("Diese Ausgabe ist nicht verfügbar.");
  }
  if (!existing || existing.updatedAt <= changedAt) {
    await db.expense.updateMany({ where: { id, familyId: session.family.id, ownerUserId: session.user.id }, data: persisted });
  }
  return { id };
}

async function applyTaskChange(session: SyncSession, change: z.infer<typeof syncChangeSchema>) {
  const id = change.entityId ?? change.localId;
  if (!id) throw new Error("Aufgaben-Sync braucht eine ID.");
  const changedAt = parseIsoDateTime(change.changedAt);
  if (change.action === "delete") {
    const existing = await db.task.findFirst({
      where: { id, familyId: session.family.id, OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }] }
    });
    if (!existing || existing.updatedAt <= changedAt) {
      await db.task.deleteMany({
        where: {
          id,
          familyId: session.family.id,
          OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }]
        }
      });
    }
    return { id };
  }

  if (change.action === "create") {
    const data = taskDataSchema.parse(change.data);
    const assignedToUserId = await resolveTaskAssigneeId(session.family.id, data.assignedToUserId || null);
    const persisted = {
      assignedToUserId,
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      dueDate: parseOptionalDateInput(data.dueDate),
      scope: data.scope
    };
    const existing = await db.task.findUnique({ where: { id }, select: { familyId: true, ownerUserId: true, updatedAt: true } });
    if (existing && (existing.familyId !== session.family.id || existing.ownerUserId !== session.user.id)) {
      throw new Error("Diese Offline-Aufgabe darf nicht überschrieben werden.");
    }
    if (!existing) {
      return db.task.create({
        data: {
          id,
          familyId: session.family.id,
          ownerUserId: session.user.id,
          ...persisted
        }
      });
    }
    if (existing.updatedAt <= changedAt) {
      await db.task.updateMany({ where: { id, familyId: session.family.id, ownerUserId: session.user.id }, data: persisted });
    }
    return { id };
  }

  const patch = taskPatchSchema.parse(change.data);
  const assignedToUserId = patch.assignedToUserId !== undefined
    ? await resolveTaskAssigneeId(session.family.id, patch.assignedToUserId || null)
    : undefined;
  const updateData = {
    ...(patch.assignedToUserId !== undefined ? { assignedToUserId } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description || null } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: parseOptionalDateInput(patch.dueDate) } : {}),
    ...(patch.scope !== undefined ? { scope: patch.scope } : {})
  };

  const existing = await db.task.findFirst({
    where: { id, familyId: session.family.id, OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }] }
  });
  if (!existing) {
    const conflicting = await db.task.findUnique({ where: { id }, select: { id: true } });
    if (conflicting) throw new Error("Diese Aufgabe ist nicht verfügbar.");
  }
  if (!existing || existing.updatedAt <= changedAt) {
    await db.task.updateMany({
      where: {
        id,
        familyId: session.family.id,
        OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }]
      },
      data: updateData
    });
  }
  return { id };
}

function serializeExpense(expense: Awaited<ReturnType<typeof getVisibleExpenses>>[number]) {
  return {
    id: expense.id,
    kind: expense.kind,
    amountCents: expense.amountCents,
    currency: expense.currency,
    date: expense.date.toISOString(),
    paymentMethod: expense.paymentMethod,
    store: expense.store,
    categoryId: expense.categoryId,
    labelId: expense.labelId,
    contractId: expense.contractId,
    fuelEntryId: expense.fuelEntryId,
    recurringTransactionId: expense.recurringTransactionId,
    generatedByContract: expense.generatedByContract,
    generatedByFuelEntry: expense.generatedByFuelEntry,
    generatedByRecurringTransaction: expense.generatedByRecurringTransaction,
    description: expense.description,
    updatedAt: expense.updatedAt.toISOString(),
    category: expense.category,
    label: expense.label,
    contract: expense.contract ? { id: expense.contract.id, provider: expense.contract.provider, contractType: expense.contract.contractType } : null,
    recurringTransaction: expense.recurringTransaction ? { id: expense.recurringTransaction.id, title: expense.recurringTransaction.title } : null,
    fuelEntry: expense.fuelEntry ? {
      id: expense.fuelEntry.id,
      odometerKm: expense.fuelEntry.odometerKm,
      car: { id: expense.fuelEntry.car.id, name: expense.fuelEntry.car.name }
    } : null
  };
}

function serializeTask(task: Awaited<ReturnType<typeof getVisibleTasks>>[number]) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    recurringTaskId: task.recurringTaskId,
    recurringTaskDueDate: task.recurringTaskDueDate?.toISOString() ?? null,
    recurringTask: task.recurringTask ? {
      id: task.recurringTask.id,
      title: task.recurringTask.title,
      intervalCount: task.recurringTask.intervalCount,
      intervalUnit: task.recurringTask.intervalUnit
    } : null,
    scope: task.scope,
    assignedToUserId: task.assignedToUserId,
    updatedAt: task.updatedAt.toISOString(),
    owner: { id: task.owner.id, name: task.owner.name },
    assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name } : null
  };
}
