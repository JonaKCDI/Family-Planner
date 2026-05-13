import { z } from "zod";
import { db } from "@/lib/db";
import { getExpenseLabels, getFamilyMembers, getVisibleCategories, getVisibleExpenses, getVisibleTasks } from "@/lib/queries";

type SyncSession = {
  user: { id: string };
  family: { id: string };
};

const expenseDataSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  amountCents: z.number().int(),
  currency: z.string().default("EUR"),
  date: z.string(),
  paymentMethod: z.string().default("Nicht angegeben"),
  categoryId: z.string().nullable().optional(),
  labelId: z.string().nullable().optional(),
  description: z.string().min(1)
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
  const [expenses, tasks, categories, labels, members] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getFamilyMembers(session.family.id)
  ]);

  return {
    serverTime: new Date().toISOString(),
    expenses: expenses.map(serializeExpense),
    tasks: tasks.map(serializeTask),
    categories,
    labels,
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user.name
    }))
  };
}

export async function buildSyncPull(session: SyncSession, since: string | null) {
  const sinceDate = since ? new Date(since) : new Date(0);
  const [expenses, tasks] = await Promise.all([
    db.expense.findMany({
      where: {
        familyId: session.family.id,
        ownerUserId: session.user.id,
        updatedAt: { gt: sinceDate }
      },
      include: { category: true, label: true, owner: true },
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
      include: { owner: true, assignee: true },
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
  if (change.action === "delete") {
    const existing = await db.expense.findFirst({ where: { id, familyId: session.family.id, ownerUserId: session.user.id } });
    if (!existing || existing.updatedAt <= new Date(change.changedAt)) {
      await db.expense.deleteMany({ where: { id, familyId: session.family.id, ownerUserId: session.user.id } });
    }
    return { id };
  }

  const data = expenseDataSchema.parse(change.data);
  const persisted = {
    familyId: session.family.id,
    ownerUserId: session.user.id,
    kind: data.kind,
    amountCents: data.amountCents,
    currency: data.currency,
    date: new Date(data.date),
    paymentMethod: data.paymentMethod || "Nicht angegeben",
    categoryId: data.categoryId || null,
    labelId: data.labelId || null,
    description: data.description,
    scope: "PRIVATE" as const
  };

  if (change.action === "create") {
    return db.expense.upsert({
      where: { id },
      create: { id, ...persisted },
      update: persisted
    });
  }

  const existing = await db.expense.findFirst({ where: { id, familyId: session.family.id, ownerUserId: session.user.id } });
  if (!existing || existing.updatedAt <= new Date(change.changedAt)) {
    await db.expense.updateMany({ where: { id, familyId: session.family.id, ownerUserId: session.user.id }, data: persisted });
  }
  return { id };
}

async function applyTaskChange(session: SyncSession, change: z.infer<typeof syncChangeSchema>) {
  const id = change.entityId ?? change.localId;
  if (!id) throw new Error("Aufgaben-Sync braucht eine ID.");
  if (change.action === "delete") {
    const existing = await db.task.findFirst({
      where: { id, familyId: session.family.id, OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }] }
    });
    if (!existing || existing.updatedAt <= new Date(change.changedAt)) {
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
    return db.task.upsert({
      where: { id },
      create: {
        id,
        familyId: session.family.id,
        ownerUserId: session.user.id,
        assignedToUserId: data.assignedToUserId || null,
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        scope: data.scope
      },
      update: {
        assignedToUserId: data.assignedToUserId || null,
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        scope: data.scope
      }
    });
  }

  const patch = taskPatchSchema.parse(change.data);
  const updateData = {
    ...(patch.assignedToUserId !== undefined ? { assignedToUserId: patch.assignedToUserId || null } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description || null } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? new Date(patch.dueDate) : null } : {}),
    ...(patch.scope !== undefined ? { scope: patch.scope } : {})
  };

  const existing = await db.task.findFirst({
    where: { id, familyId: session.family.id, OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }] }
  });
  if (!existing || existing.updatedAt <= new Date(change.changedAt)) {
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
    categoryId: expense.categoryId,
    labelId: expense.labelId,
    description: expense.description,
    updatedAt: expense.updatedAt.toISOString(),
    category: expense.category,
    label: expense.label
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
    scope: task.scope,
    assignedToUserId: task.assignedToUserId,
    updatedAt: task.updatedAt.toISOString(),
    owner: { id: task.owner.id, name: task.owner.name },
    assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name } : null
  };
}
