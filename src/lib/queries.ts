import { db } from "@/lib/db";
import { visibleScopeWhere } from "@/lib/permissions";

export async function getFamilyMembers(familyId: string) {
  return db.familyMember.findMany({
    where: { familyId, status: "ACTIVE" },
    include: { user: true },
    orderBy: { createdAt: "asc" }
  });
}

export async function getVisibleCategories(familyId: string, userId: string, type?: "EXPENSE" | "TASK" | "CONTRACT") {
  return db.category.findMany({
    where: {
      familyId,
      ...(type ? { type } : {}),
      ...visibleScopeWhere(userId)
    },
    orderBy: { name: "asc" }
  });
}

export async function getVisibleExpenses(familyId: string, userId: string) {
  return db.expense.findMany({
    where: {
      familyId,
      ownerUserId: userId
    },
    include: { category: true, label: true, contract: true },
    orderBy: { date: "desc" }
  });
}

export async function getExpenseLabels(familyId: string, userId: string, options: { includeArchived?: boolean } = {}) {
  const labels = await db.expenseLabel.findMany({
    where: {
      familyId,
      ownerUserId: userId,
      ...(options.includeArchived ? {} : { archivedAt: null })
    },
    include: {
      expenses: {
        select: { date: true },
        orderBy: { date: "desc" },
        take: 1
      }
    },
    orderBy: { name: "asc" }
  });

  const staleCutoff = new Date();
  staleCutoff.setFullYear(staleCutoff.getFullYear() - 2);

  return labels
    .map(({ expenses, ...label }) => ({
      ...label,
      lastUsedAt: expenses[0]?.date ?? null
    }))
    .sort((a, b) => {
      if (Boolean(a.archivedAt) !== Boolean(b.archivedAt)) return a.archivedAt ? 1 : -1;
      const aLastUsed = a.lastUsedAt?.getTime() ?? null;
      const bLastUsed = b.lastUsedAt?.getTime() ?? null;
      const aRecent = aLastUsed !== null && a.lastUsedAt !== null && a.lastUsedAt >= staleCutoff;
      const bRecent = bLastUsed !== null && b.lastUsedAt !== null && b.lastUsedAt >= staleCutoff;

      if (aRecent !== bRecent) return aRecent ? -1 : 1;
      if (aLastUsed !== null && bLastUsed !== null && aLastUsed !== bLastUsed) return bLastUsed - aLastUsed;
      if (aLastUsed !== null && bLastUsed === null) return -1;
      if (aLastUsed === null && bLastUsed !== null) return 1;
      return a.name.localeCompare(b.name, "de");
    });
}

export async function getVisibleCars(familyId: string, options: { includeArchived?: boolean } = {}) {
  return db.car.findMany({
    where: {
      familyId,
      ...(options.includeArchived ? {} : { archivedAt: null })
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }]
  });
}

export async function getFuelEntriesForCar(familyId: string, carId: string) {
  return db.fuelEntry.findMany({
    where: {
      familyId,
      carId
    },
    include: { car: true, creator: true },
    orderBy: [{ date: "desc" }, { odometerKm: "desc" }]
  });
}

export async function getDocumentsForLinkedEntities(
  familyId: string,
  userId: string,
  linkedEntityType: "EXPENSE" | "CONTRACT",
  linkedEntityIds: string[]
) {
  if (linkedEntityIds.length === 0) return [];
  return db.documentReference.findMany({
    where: {
      familyId,
      linkedEntityType,
      linkedEntityId: { in: linkedEntityIds },
      ...visibleScopeWhere(userId)
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getVisibleTasks(familyId: string, userId: string) {
  return db.task.findMany({
    where: {
      familyId,
      ...visibleScopeWhere(userId)
    },
    include: { owner: true, assignee: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  });
}

export async function getVisibleContracts(familyId: string, userId: string) {
  return db.contract.findMany({
    where: {
      familyId,
      ...visibleScopeWhere(userId)
    },
    include: { owner: true },
    orderBy: [{ status: "asc" }, { nextCancellationDate: "asc" }]
  });
}

export async function getVisibleContractPayments(familyId: string, userId: string, contractIds: string[]) {
  if (contractIds.length === 0) return [];
  return db.expense.findMany({
    where: {
      familyId,
      ownerUserId: userId,
      kind: "EXPENSE",
      contractId: { in: contractIds }
    },
    include: { category: true, label: true, contract: true },
    orderBy: { date: "desc" }
  });
}

export async function getVisibleDocuments(familyId: string, userId: string) {
  return db.documentReference.findMany({
    where: {
      familyId,
      ...visibleScopeWhere(userId)
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" }
  });
}
