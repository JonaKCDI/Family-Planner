import { db } from "@/lib/db";
import { getRecurringTaskGenerationDecision } from "@/lib/tasks";

const recurringTaskChecks = new Map<string, number>();
const recurringTaskCheckTtlMs = 60_000;

export async function ensureDueRecurringTasks(
  familyId: string,
  userId: string,
  referenceDate = new Date(),
  options: { force?: boolean } = {}
) {
  const checkKey = `${familyId}:${userId}:${dateKey(startOfUtcDay(referenceDate))}`;
  const checkedAt = recurringTaskChecks.get(checkKey);
  if (!options.force && checkedAt && Date.now() - checkedAt < recurringTaskCheckTtlMs) return;

  const plans = await db.recurringTask.findMany({
    where: {
      familyId,
      status: "ACTIVE",
      OR: [{ scope: "FAMILY" }, { ownerUserId: userId }]
    }
  });

  for (const plan of plans) {
    const decision = getRecurringTaskGenerationDecision(plan, referenceDate);
    if (!decision.shouldGenerate || !decision.dueDate) {
      await updateNextDueDate(plan.id, plan.nextDueDate, decision.nextDueDate);
      continue;
    }

    const existing = await db.task.findFirst({
      where: {
        familyId,
        recurringTaskId: plan.id,
        recurringTaskDueDate: decision.dueDate
      },
      select: { id: true }
    });

    if (!existing) {
      await db.task.create({
        data: {
          familyId,
          ownerUserId: plan.ownerUserId,
          assignedToUserId: plan.assignedToUserId,
          title: plan.title,
          description: plan.description,
          status: "OPEN",
          priority: plan.priority,
          dueDate: decision.dueDate,
          recurringTaskId: plan.id,
          recurringTaskDueDate: decision.dueDate,
          scope: plan.scope
        }
      }).catch(async (error: unknown) => {
        if (!isUniqueConstraintError(error)) throw error;
      });
    }

    await updateNextDueDate(plan.id, plan.nextDueDate, decision.nextDueDate);
  }

  recurringTaskChecks.set(checkKey, Date.now());
}

async function updateNextDueDate(id: string, current: Date | null, next: Date | null) {
  if (dateKeyOrNull(current) === dateKeyOrNull(next)) return;
  await db.recurringTask.update({
    where: { id },
    data: { nextDueDate: next }
  });
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function startOfUtcDay(value: Date | string) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKeyOrNull(date: Date | null | undefined) {
  return date ? dateKey(date) : null;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
