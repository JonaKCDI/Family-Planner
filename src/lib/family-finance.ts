import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { cache } from "react";
import type { ExpenseFilterParams } from "@/lib/expense-filter-url";

type FamilyTransferRow = { id: string; senderUserId: string; recipientUserId: string; createdByUserId: string; amountCents: number; currency: string; date: Date; note: string | null; createdAt: Date; sender: { id: string; name: string }; recipient: { id: string; name: string } };

export async function requireFinanceMember() {
  const session = await requireSession();
  const member = await db.familyMember.findFirst({ where: { familyId: session.family.id, userId: session.user.id, status: "ACTIVE" } });
  if (!member) throw new Error("Dieser Familienbereich ist nicht verfügbar.");
  return { ...session, role: member.role };
}

/** Intentionally no expense relation includes: private source metadata never leaves this query. */
export const getFamilyFinance = cache(async function getFamilyFinance() {
  return loadFamilyFinance();
});

export const getFamilyFinanceBounds = cache(async function getFamilyFinanceBounds(familyId: string) {
  await ensureFamilyDueExpenses(familyId);
  const bounds = await db.expense.aggregate({
    where: { familyId, sharedWithFamily: true, kind: "EXPENSE" },
    _min: { date: true }, _max: { date: true }
  });
  return [bounds._min.date, bounds._max.date].filter((date): date is Date => Boolean(date)).map(date => ({ date }));
});

export function getFamilyFinanceForRange(range: { from: Date; to: Date }, currency?: string) {
  return getFamilyFinanceForRangeCached(range.from.toISOString(), range.to.toISOString(), currency ?? "");
}

export async function getFamilyFinancePage(range: { from: Date; to: Date }, params: ExpenseFilterParams & { person?: string | null }, offset: number, limit: number) {
  const values = (value: string | string[] | null | undefined) => Array.isArray(value) ? value : value ? [value] : [];
  const sort = params.sort || "date-desc";
  if (String(params.q ?? "").trim() || values(params.category).length || values(params.label).length ||
      (sort !== "date-desc" && sort !== "date-asc")) return null;
  const session = await requireFinanceMember();
  const familyId = session.family.id;
  await ensureFamilyDueExpenses(familyId);
  const currency = /^[A-Z]{3}$/.test(params.currency || "") ? params.currency! : "EUR";
  const methods = values(params.paymentMethod);
  const where = {
    familyId, sharedWithFamily: true, kind: "EXPENSE" as const, currency,
    date: { gte: range.from, lte: range.to },
    ...(params.person ? { ownerUserId: params.person } : {}),
    ...(methods.length ? { paymentMethod: { in: methods } } : {})
  };
  const [totalCount, rows, categoryMaps, labelMaps, categories, labels] = await Promise.all([
    db.expense.count({ where }),
    db.expense.findMany({ where, skip: offset, take: limit,
      select: { id: true, date: true, amountCents: true, currency: true, description: true, store: true, paymentMethod: true,
        ownerUserId: true, categoryId: true, labelId: true, owner: { select: { id: true, name: true } } },
      orderBy: [{ date: sort === "date-asc" ? "asc" : "desc" }, { id: "asc" }] }),
    db.familyCategoryMapping.findMany({ where: { familyId } }),
    db.familyLabelMapping.findMany({ where: { familyId } }),
    db.familyFinanceCategory.findMany({ where: { familyId } }),
    db.familyFinanceLabel.findMany({ where: { familyId } })
  ]);
  const categoryTarget = new Map(categoryMaps.map(row => [`${row.userId}:${row.personalId}`, row.targetId]));
  const labelTarget = new Map(labelMaps.map(row => [`${row.userId}:${row.personalId}`, row.targetId]));
  const categoryById = new Map(categories.map(row => [row.id, row]));
  const labelById = new Map(labels.map(row => [row.id, row]));
  const expenses = rows.map(row => {
    const categoryId = categoryTarget.get(`${row.ownerUserId}:${row.categoryId}`) ?? null;
    const labelId = labelTarget.get(`${row.ownerUserId}:${row.labelId}`) ?? null;
    return { id: row.id, date: row.date, kind: "EXPENSE" as const, amountCents: row.amountCents, currency: row.currency,
      description: row.description, store: row.store, paymentMethod: row.paymentMethod, person: row.owner,
      canEdit: row.ownerUserId === session.user.id, categoryId, labelId,
      category: categoryById.get(categoryId ?? "") ?? null, label: labelById.get(labelId ?? "") ?? null };
  });
  return { totalCount, expenses };
}

const getFamilyFinanceForRangeCached = cache(async function getFamilyFinanceForRangeCached(from: string, to: string, currency: string) {
  return loadFamilyFinance({ from: new Date(from), to: new Date(to) }, currency || undefined);
});

async function loadFamilyFinance(range?: { from: Date; to: Date }, budgetCurrency?: string) {
  const session = await requireFinanceMember();
  const familyId = session.family.id;
  // A hot-reloaded development server can still hold the Prisma client generated
  // before this additive model existed. Keep the existing finance view usable
  // until that server is restarted; deployed clients are generated at build time.
  const transferDelegate = (db as unknown as { familyTransfer?: { findMany: (args: unknown) => Promise<FamilyTransferRow[]> } }).familyTransfer;
  await ensureFamilyDueExpenses(familyId);
  const [rows, categories, labels, categoryMaps, labelMaps, transfers, members, budgetGroups] = await Promise.all([
    db.expense.findMany({ where: { familyId, sharedWithFamily: true, kind: "EXPENSE", ...(range ? { date: { gte: range.from, lte: range.to } } : {}) }, select: {
      id: true, date: true, amountCents: true, currency: true, description: true, store: true, paymentMethod: true,
      ownerUserId: true, categoryId: true, labelId: true, owner: { select: { id: true, name: true } }
    }, orderBy: [{ date: "desc" }, { id: "asc" }] }),
    db.familyFinanceCategory.findMany({ where: { familyId }, orderBy: { name: "asc" } }),
    db.familyFinanceLabel.findMany({ where: { familyId }, orderBy: { name: "asc" } }),
    db.familyCategoryMapping.findMany({ where: { familyId } }),
    db.familyLabelMapping.findMany({ where: { familyId } }),
    transferDelegate ? transferDelegate.findMany({
      where: { familyId, ...(range ? { date: { gte: range.from, lte: range.to } } : {}) },
      select: {
        id: true, senderUserId: true, recipientUserId: true, createdByUserId: true,
        amountCents: true, currency: true, date: true, note: true, createdAt: true,
        sender: { select: { id: true, name: true } }, recipient: { select: { id: true, name: true } }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    }) : Promise.resolve([]),
    db.familyMember.findMany({ where: { familyId, status: "ACTIVE" }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }),
    range && budgetCurrency ? db.expense.groupBy({
      by: ["ownerUserId", "labelId"],
      where: { familyId, sharedWithFamily: true, kind: "EXPENSE", currency: budgetCurrency, labelId: { not: null } },
      _sum: { amountCents: true }
    }) : Promise.resolve([])
  ]);
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const labelById = new Map(labels.map(l => [l.id, l]));
  const categoryTargetByOwner = new Map(categoryMaps.map(m => [`${m.userId}:${m.personalId}`, m.targetId]));
  const labelTargetByOwner = new Map(labelMaps.map(m => [`${m.userId}:${m.personalId}`, m.targetId]));
  const labelBudgetTotals = new Map<string, { income: number; spending: number }>();
  for (const group of budgetGroups) {
    const targetId = labelTargetByOwner.get(`${group.ownerUserId}:${group.labelId}`);
    if (!targetId) continue;
    const total = labelBudgetTotals.get(targetId) ?? { income: 0, spending: 0 };
    total.spending += group._sum.amountCents ?? 0;
    labelBudgetTotals.set(targetId, total);
  }
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
  return { session, expenses, categories, labels, transfers, members: members.map(member => member.user), labelBudgetTotals };
}

async function ensureFamilyDueExpenses(familyId: string) {
  const [contractOwners, seriesOwners] = await Promise.all([
    db.contract.findMany({ where: { familyId, expenseSharedWithFamily: true, owner: { memberships: { some: { familyId, status: "ACTIVE" } } } }, select: { ownerUserId: true }, distinct: ["ownerUserId"] }),
    db.recurringTransaction.findMany({ where: { familyId, sharedWithFamily: true, kind: "EXPENSE", owner: { memberships: { some: { familyId, status: "ACTIVE" } } } }, select: { ownerUserId: true }, distinct: ["ownerUserId"] })
  ]);
  for (const userId of new Set([...contractOwners, ...seriesOwners].map(row => row.ownerUserId))) {
    await ensureDueContractExpenses(familyId, userId);
  }
}

export type FamilyFinanceExpense = Awaited<ReturnType<typeof getFamilyFinance>>["expenses"][number];
