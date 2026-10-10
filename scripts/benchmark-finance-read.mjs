// Read-only comparison of the expense work behind an unfiltered monthly view.
// Run with `node scripts/benchmark-finance-read.mjs` against a local or restored DB.
import { PrismaClient } from "@prisma/client";

process.loadEnvFile();
const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
let statements = 0;
db.$on("query", () => { statements += 1; });
const now = new Date();
const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1);
const fullInclude = {
  category: true, label: true, contract: true,
  recurringTransaction: { include: { pricePhases: { orderBy: { validFrom: "asc" } } } },
  fuelEntry: { include: { car: true } }
};
const candidateSelect = {
  id: true, familyId: true, ownerUserId: true, kind: true, amountCents: true,
  currency: true, date: true, createdAt: true, description: true, store: true,
  paymentMethod: true, categoryId: true, labelId: true, contractId: true,
  recurringTransactionId: true, fuelEntryId: true, generatedByContract: true,
  generatedByRecurringTransaction: true, generatedByFuelEntry: true,
  sharedWithFamily: true, category: true, label: true,
  contract: { select: { provider: true, contractType: true } },
  recurringTransaction: { select: { title: true } },
  fuelEntry: { select: { odometerKm: true, car: { select: { name: true } } } }
};
const measure = async (name, fn) => {
  statements = 0;
  const start = performance.now();
  const result = await fn();
  return { name, ms: Math.round(performance.now() - start), statements, ...result };
};
try {
  const owners = await db.expense.groupBy({ by: ["familyId", "ownerUserId"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 1 });
  const owner = owners[0];
  if (!owner) { console.log("No expense rows to benchmark."); process.exit(0); }
  const where = { familyId: owner.familyId, ownerUserId: owner.ownerUserId };
  const old = await measure("old full-history expense read", async () => {
    const rows = await db.expense.findMany({ where, include: fullInclude, orderBy: { date: "desc" } });
    return { rows: rows.length };
  });
  const current = await measure("new monthly overview expense reads", async () => {
    const [bounds, years, methods, rows, labelTotals] = await Promise.all([
      db.expense.aggregate({ where, _min: { date: true }, _max: { date: true } }),
      db.$queryRaw`SELECT DISTINCT EXTRACT(YEAR FROM "date")::integer AS year FROM "Expense" WHERE "familyId" = ${owner.familyId} AND "ownerUserId" = ${owner.ownerUserId} ORDER BY year DESC`,
      db.$queryRaw`SELECT DISTINCT "paymentMethod" FROM "Expense" WHERE "familyId" = ${owner.familyId} AND "ownerUserId" = ${owner.ownerUserId} ORDER BY "paymentMethod"`,
      db.expense.findMany({ where: { ...where, date: { gte: from, lte: to } }, select: candidateSelect, orderBy: { date: "desc" } }),
      db.expense.groupBy({ by: ["labelId", "kind"], where: { ...where, currency: "EUR", labelId: { not: null } }, _sum: { amountCents: true } })
    ]);
    const full = await db.expense.findMany({ where: { ...where, id: { in: rows.slice(0, 100).map(row => row.id) } }, include: fullInclude });
    void bounds; void years; void methods; void labelTotals;
    return { rows: rows.length, fullDetailRows: full.length };
  });
  console.log(JSON.stringify({ historicalRows: owner._count.id, month: from.toISOString().slice(0, 7), old, current }, null, 2));
} finally {
  await db.$disconnect();
}
