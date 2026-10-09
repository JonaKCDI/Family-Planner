import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { cache } from "react";

type FamilyTransferRow = { id: string; senderUserId: string; recipientUserId: string; createdByUserId: string; amountCents: number; currency: string; date: Date; note: string | null; createdAt: Date; sender: { id: string; name: string }; recipient: { id: string; name: string } };

export async function requireFinanceMember() {
  const session = await requireSession();
  const member = await db.familyMember.findFirst({ where: { familyId: session.family.id, userId: session.user.id, status: "ACTIVE" } });
  if (!member) throw new Error("Dieser Familienbereich ist nicht verfügbar.");
  return { ...session, role: member.role };
}

/** Intentionally no expense relation includes: private source metadata never leaves this query. */
export const getFamilyFinance = cache(async function getFamilyFinance() {
  const session = await requireFinanceMember();
  const familyId = session.family.id;
  // A hot-reloaded development server can still hold the Prisma client generated
  // before this additive model existed. Keep the existing finance view usable
  // until that server is restarted; deployed clients are generated at build time.
  const transferDelegate = (db as unknown as { familyTransfer?: { findMany: (args: unknown) => Promise<FamilyTransferRow[]> } }).familyTransfer;
  const [contractOwners, seriesOwners] = await Promise.all([
    db.contract.findMany({ where: { familyId, expenseSharedWithFamily: true, owner: { memberships: { some: { familyId, status: "ACTIVE" } } } }, select: { ownerUserId: true }, distinct: ["ownerUserId"] }),
    db.recurringTransaction.findMany({ where: { familyId, sharedWithFamily: true, kind: "EXPENSE", owner: { memberships: { some: { familyId, status: "ACTIVE" } } } }, select: { ownerUserId: true }, distinct: ["ownerUserId"] })
  ]);
  for (const userId of new Set([...contractOwners, ...seriesOwners].map(row => row.ownerUserId))) await ensureDueContractExpenses(familyId, userId);
  const [rows, categories, labels, categoryMaps, labelMaps, transfers, members] = await Promise.all([
    db.expense.findMany({ where: { familyId, sharedWithFamily: true, kind: "EXPENSE" }, select: {
      id: true, date: true, amountCents: true, currency: true, description: true, store: true, paymentMethod: true,
      ownerUserId: true, categoryId: true, labelId: true, owner: { select: { id: true, name: true } }
    }, orderBy: [{ date: "desc" }, { id: "asc" }] }),
    db.familyFinanceCategory.findMany({ where: { familyId }, orderBy: { name: "asc" } }),
    db.familyFinanceLabel.findMany({ where: { familyId }, orderBy: { name: "asc" } }),
    db.familyCategoryMapping.findMany({ where: { familyId } }),
    db.familyLabelMapping.findMany({ where: { familyId } }),
    transferDelegate ? transferDelegate.findMany({
      where: { familyId },
      select: {
        id: true, senderUserId: true, recipientUserId: true, createdByUserId: true,
        amountCents: true, currency: true, date: true, note: true, createdAt: true,
        sender: { select: { id: true, name: true } }, recipient: { select: { id: true, name: true } }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    }) : Promise.resolve([]),
    db.familyMember.findMany({ where: { familyId, status: "ACTIVE" }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } })
  ]);
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const labelById = new Map(labels.map(l => [l.id, l]));
  const categoryTargetByOwner = new Map(categoryMaps.map(m => [`${m.userId}:${m.personalId}`, m.targetId]));
  const labelTargetByOwner = new Map(labelMaps.map(m => [`${m.userId}:${m.personalId}`, m.targetId]));
  const expenses = rows.map(row => {
    const categoryId = categoryTargetByOwner.get(`${row.ownerUserId}:${row.categoryId}`);
    const labelId = labelTargetByOwner.get(`${row.ownerUserId}:${row.labelId}`);
    return {
      id: row.id, date: row.date, kind: "EXPENSE" as const, amountCents: row.amountCents, currency: row.currency,
      description: row.description, store: row.store, paymentMethod: row.paymentMethod,
      person: row.owner, canEdit: row.ownerUserId === session.user.id,
      categoryId: categoryId ?? null, labelId: labelId ?? null,
      category: categoryById.get(categoryId ?? "") ?? null, label: labelById.get(labelId ?? "") ?? null
    };
  });
  return { session, expenses, categories, labels, transfers, members: members.map(member => member.user) };
});

export type FamilyFinanceExpense = Awaited<ReturnType<typeof getFamilyFinance>>["expenses"][number];
