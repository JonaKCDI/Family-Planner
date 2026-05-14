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
    include: { category: true, owner: true, label: true },
    orderBy: { date: "desc" }
  });
}

export async function getExpenseLabels(familyId: string, userId: string) {
  return db.expenseLabel.findMany({
    where: { familyId, ownerUserId: userId },
    orderBy: { name: "asc" }
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
