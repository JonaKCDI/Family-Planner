import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cache } from "react";
import { normalizeList } from "@/lib/expense-filters";
import type { ExpenseFilterParams } from "@/lib/expense-filter-url";
import { getExpenseSortKey } from "@/lib/expense-sorting";

// A finance calculation/search row deliberately omits the edit graphs attached
// to contracts, recurring series and fuel entries. Fetch those by ID only for
// rows that are actually displayed or opened.
const candidateSelect = {
  id: true, familyId: true, ownerUserId: true, kind: true, amountCents: true,
  currency: true, date: true, createdAt: true, description: true, store: true,
  paymentMethod: true, categoryId: true, labelId: true, contractId: true,
  recurringTransactionId: true, fuelEntryId: true, generatedByContract: true,
  generatedByRecurringTransaction: true, generatedByFuelEntry: true,
  sharedWithFamily: true,
  category: true,
  label: true,
  contract: { select: { provider: true, contractType: true } },
  recurringTransaction: { select: { title: true } },
  fuelEntry: { select: { odometerKm: true, car: { select: { name: true } } } }
} satisfies Prisma.ExpenseSelect;

export type FinanceExpenseCandidate = Prisma.ExpenseGetPayload<{ select: typeof candidateSelect }>;

export const getPersonalFinanceMetadata = cache(async function getPersonalFinanceMetadata(familyId: string, userId: string) {
  const where = { familyId, ownerUserId: userId };
  const [bounds, years, methods] = await Promise.all([
    db.expense.aggregate({ where, _min: { date: true }, _max: { date: true } }),
    db.$queryRaw<{ year: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM "date")::integer AS year
      FROM "Expense" WHERE "familyId" = ${familyId} AND "ownerUserId" = ${userId}
      ORDER BY year DESC
    `,
    db.$queryRaw<{ paymentMethod: string }[]>`
      SELECT DISTINCT "paymentMethod"
      FROM "Expense" WHERE "familyId" = ${familyId} AND "ownerUserId" = ${userId}
      ORDER BY "paymentMethod"
    `
  ]);
  return {
    rangeEntries: [bounds._min.date, bounds._max.date].filter((date): date is Date => Boolean(date)).map(date => ({ date })),
    years: years.map(row => row.year),
    paymentMethods: methods.map(row => row.paymentMethod)
  };
});

export function getPersonalExpenseCandidates(familyId: string, userId: string, range: { from: Date; to: Date }) {
  return getPersonalExpenseCandidatesCached(familyId, userId, range.from.toISOString(), range.to.toISOString());
}

const getPersonalExpenseCandidatesCached = cache(async function getPersonalExpenseCandidatesCached(familyId: string, userId: string, from: string, to: string) {
  return db.expense.findMany({
    where: { familyId, ownerUserId: userId, date: { gte: new Date(from), lte: new Date(to) } },
    select: candidateSelect,
    orderBy: { date: "desc" }
  });
});

export async function getPersonalLabelBudgetTotals(familyId: string, userId: string, currency: string) {
  const totals = await db.expense.groupBy({
    by: ["labelId", "kind"],
    where: { familyId, ownerUserId: userId, currency, labelId: { not: null } },
    _sum: { amountCents: true }
  });
  const byLabel = new Map<string, { income: number; spending: number }>();
  for (const row of totals) {
    if (!row.labelId) continue;
    const entry = byLabel.get(row.labelId) ?? { income: 0, spending: 0 };
    if (row.kind === "INCOME") entry.income += row._sum.amountCents ?? 0;
    else entry.spending += row._sum.amountCents ?? 0;
    byLabel.set(row.labelId, entry);
  }
  return byLabel;
}

export const getPersonalForecastRows = cache(async function getPersonalForecastRows(familyId: string, userId: string) {
  return db.expense.findMany({
    where: { familyId, ownerUserId: userId },
    select: { kind: true, amountCents: true, date: true, categoryId: true },
    orderBy: { date: "desc" }
  });
});

// The common list path can page in PostgreSQL. Text/document search, source
// classification and category-frequency sorts retain their exact JS semantics.
export async function getPersonalExpensePage(
  familyId: string, userId: string, range: { from: Date; to: Date },
  params: ExpenseFilterParams, offset: number, limit: number
) {
  const sort = getExpenseSortKey(params.sort);
  if (String(params.q ?? "").trim() || normalizeList(params.source).length || (sort !== "date-desc" && sort !== "date-asc")) return null;
  const categories = normalizeList(params.category);
  const labels = normalizeList(params.label);
  const methods = normalizeList(params.paymentMethod);
  const where: Prisma.ExpenseWhereInput = {
    familyId, ownerUserId: userId,
    date: { gte: range.from, lte: range.to },
    ...(params.currency ? { currency: params.currency } : {}),
    ...(params.kind === "expense" ? { kind: "EXPENSE" } : params.kind === "income" ? { kind: "INCOME" } : {}),
    ...(methods.length ? { paymentMethod: { in: methods } } : {}),
  };
  if (categories.length || labels.length) {
    where.AND = [
      ...(categories.length ? [{ OR: [
        { categoryId: { in: categories.filter(value => value !== "unassigned") } },
        ...(categories.includes("unassigned") ? [{ categoryId: null }] : [])
      ] }] : []),
      ...(labels.length ? [{ OR: [
        { labelId: { in: labels.filter(value => value !== "unassigned") } },
        ...(labels.includes("unassigned") ? [{ labelId: null }] : [])
      ] }] : [])
    ];
  }
  const [totalCount, ids] = await Promise.all([
    db.expense.count({ where }),
    db.expense.findMany({ where, select: { id: true }, skip: offset, take: limit,
      orderBy: [{ date: sort === "date-asc" ? "asc" : "desc" }, { createdAt: "desc" }, { id: "asc" }] })
  ]);
  return { totalCount, ids: ids.map(row => row.id) };
}
