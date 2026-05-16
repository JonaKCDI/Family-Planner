import { db } from "@/lib/db";
import { visibleScopeWhere } from "@/lib/permissions";

type LinkedEntityType = "EXPENSE" | "TASK" | "CONTRACT" | "GENERAL";

export async function resolveExpenseCategoryId(familyId: string, userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const category = await db.category.findFirst({
    where: {
      id: categoryId,
      familyId,
      type: "EXPENSE",
      ...visibleScopeWhere(userId)
    },
    select: { id: true }
  });
  if (!category) throw new Error("Die ausgewählte Kategorie ist nicht verfügbar.");
  return category.id;
}

export async function resolveExpenseLabelId(familyId: string, userId: string, labelId: string | null | undefined) {
  if (!labelId) return null;
  const label = await db.expenseLabel.findFirst({
    where: { id: labelId, familyId, ownerUserId: userId },
    select: { id: true }
  });
  if (!label) throw new Error("Das ausgewählte Label ist nicht verfügbar.");
  return label.id;
}

export async function resolveVisibleContractId(familyId: string, userId: string, contractId: string | null | undefined) {
  if (!contractId) return null;
  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      familyId,
      ...visibleScopeWhere(userId)
    },
    select: { id: true }
  });
  if (!contract) throw new Error("Der ausgewählte Vertrag ist nicht verfügbar.");
  return contract.id;
}

export async function resolveTaskAssigneeId(familyId: string, assignedToUserId: string | null | undefined) {
  if (!assignedToUserId) return null;
  const member = await db.familyMember.findFirst({
    where: { familyId, userId: assignedToUserId, status: "ACTIVE" },
    select: { userId: true }
  });
  if (!member) throw new Error("Das ausgewählte Familienmitglied ist nicht verfügbar.");
  return member.userId;
}

export async function resolveDocumentLinkedEntityId(
  familyId: string,
  userId: string,
  linkedEntityType: LinkedEntityType,
  linkedEntityId: string | null | undefined
) {
  if (linkedEntityType === "GENERAL") return null;
  if (!linkedEntityId) return null;

  if (linkedEntityType === "EXPENSE") {
    const expense = await db.expense.findFirst({
      where: { id: linkedEntityId, familyId, ownerUserId: userId },
      select: { id: true }
    });
    if (!expense) throw new Error("Die verknüpfte Ausgabe ist nicht verfügbar.");
    return expense.id;
  }

  if (linkedEntityType === "TASK") {
    const task = await db.task.findFirst({
      where: { id: linkedEntityId, familyId, ...visibleScopeWhere(userId) },
      select: { id: true }
    });
    if (!task) throw new Error("Die verknüpfte Aufgabe ist nicht verfügbar.");
    return task.id;
  }

  const contract = await db.contract.findFirst({
    where: { id: linkedEntityId, familyId, ...visibleScopeWhere(userId) },
    select: { id: true }
  });
  if (!contract) throw new Error("Der verknüpfte Vertrag ist nicht verfügbar.");
  return contract.id;
}
