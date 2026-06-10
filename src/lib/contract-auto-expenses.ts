import { db } from "@/lib/db";

type BillingInterval = "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONCE" | "OTHER";
type ContractStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "DRAFT";
type RecurringStatus = "ACTIVE" | "PAUSED";

export type PricePhaseLike = {
  amountCents: number;
  currency: string;
  billingInterval: BillingInterval;
  validFrom: Date | string;
  validTo?: Date | string | null;
};

const automaticExpenseChecks = new Map<string, number>();
const automaticExpenseCheckTtlMs = 60_000;

type AutoExpenseContract = {
  id: string;
  familyId: string;
  ownerUserId: string;
  provider: string;
  contractType: string;
  costCents: number;
  currency: string;
  billingInterval: BillingInterval;
  startDate: Date | string;
  endDate?: Date | string | null;
  status: ContractStatus;
  autoRenewal: boolean;
  autoCreateExpenses: boolean;
  expensePaymentDay?: number | null;
  expenseCategoryId?: string | null;
  expenseLabelId?: string | null;
  pricePhases?: PricePhaseLike[];
};

type AutoExpenseRecurringTransaction = {
  id: string;
  familyId: string;
  ownerUserId: string;
  kind: "EXPENSE" | "INCOME";
  title: string;
  description: string;
  paymentMethod: string;
  store: string;
  categoryId?: string | null;
  labelId?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  status: RecurringStatus;
  deletedAt?: Date | string | null;
  pricePhases?: PricePhaseLike[];
};

export async function ensureDueContractExpenses(familyId: string, userId: string, referenceDate = new Date(), options: { force?: boolean } = {}) {
  await ensureDueAutomaticExpenses(familyId, userId, referenceDate, options);
}

export async function ensureDueAutomaticExpenses(familyId: string, userId: string, referenceDate = new Date(), options: { force?: boolean } = {}) {
  const checkKey = `${familyId}:${userId}:${dateKey(startOfUtcDay(referenceDate))}`;
  const checkedAt = automaticExpenseChecks.get(checkKey);
  if (!options.force && checkedAt && Date.now() - checkedAt < automaticExpenseCheckTtlMs) return;

  await Promise.all([
    ensureDueContractAutomaticExpenses(familyId, userId, referenceDate),
    ensureDueRecurringTransactionExpenses(familyId, userId, referenceDate)
  ]);
  automaticExpenseChecks.set(checkKey, Date.now());
}

async function ensureDueContractAutomaticExpenses(familyId: string, userId: string, referenceDate: Date) {
  const contracts = await db.contract.findMany({
    where: {
      familyId,
      ownerUserId: userId,
      status: "ACTIVE",
      autoCreateExpenses: true
    },
    include: {
      pricePhases: { orderBy: { validFrom: "asc" } }
    }
  });

  for (const contract of contracts) {
    const dueDates = getDueContractExpenseDates(contract, referenceDate);
    if (dueDates.length === 0) continue;

    const existing = await db.expense.findMany({
      where: {
        familyId,
        ownerUserId: userId,
        contractId: contract.id,
        generatedByContract: true,
        date: { in: dueDates }
      },
      select: { date: true }
    });
    const existingKeys = new Set(existing.map((expense) => dateKey(expense.date)));
    const missingRows = dueDates
      .filter((date) => !existingKeys.has(dateKey(date)))
      .map((date) => ({ date, phase: getPricePhaseForDate(contract.pricePhases, date) }))
      .filter((row): row is { date: Date; phase: PricePhaseLike } => Boolean(row.phase) && row.phase.amountCents > 0);
    if (missingRows.length === 0) continue;

    await db.expense.createMany({
      data: missingRows.map(({ date, phase }) => ({
        familyId,
        ownerUserId: userId,
        kind: "EXPENSE",
        amountCents: phase.amountCents,
        currency: phase.currency,
        date,
        paymentMethod: "Vertrag",
        store: contract.provider,
        categoryId: contract.expenseCategoryId,
        labelId: contract.expenseLabelId,
        contractId: contract.id,
        generatedByContract: true,
        description: `${contract.provider} · ${contract.contractType}`,
        scope: "PRIVATE"
      })),
      skipDuplicates: true
    });
  }
}

async function ensureDueRecurringTransactionExpenses(familyId: string, userId: string, referenceDate: Date) {
  const recurringTransactions = await db.recurringTransaction.findMany({
    where: {
      familyId,
      ownerUserId: userId,
      status: "ACTIVE",
      deletedAt: null
    },
    include: {
      pricePhases: { orderBy: { validFrom: "asc" } }
    }
  });

  for (const transaction of recurringTransactions) {
    const dueDates = getDueRecurringTransactionDates(transaction, referenceDate);
    if (dueDates.length === 0) continue;

    const existing = await db.expense.findMany({
      where: {
        familyId,
        ownerUserId: userId,
        recurringTransactionId: transaction.id,
        generatedByRecurringTransaction: true,
        date: { in: dueDates }
      },
      select: { date: true }
    });
    const existingKeys = new Set(existing.map((expense) => dateKey(expense.date)));
    const missingRows = dueDates
      .filter((date) => !existingKeys.has(dateKey(date)))
      .map((date) => ({ date, phase: getPricePhaseForDate(transaction.pricePhases, date) }))
      .filter((row): row is { date: Date; phase: PricePhaseLike } => Boolean(row.phase) && row.phase.amountCents > 0);
    if (missingRows.length === 0) continue;

    await db.expense.createMany({
      data: missingRows.map(({ date, phase }) => ({
        familyId,
        ownerUserId: userId,
        kind: transaction.kind,
        amountCents: phase.amountCents,
        currency: phase.currency,
        date,
        paymentMethod: transaction.paymentMethod || "Nicht angegeben",
        store: transaction.store,
        categoryId: transaction.categoryId,
        labelId: transaction.labelId,
        recurringTransactionId: transaction.id,
        generatedByRecurringTransaction: true,
        description: transaction.description || transaction.title,
        scope: "PRIVATE"
      })),
      skipDuplicates: true
    });
  }
}

export function getDueContractExpenseDates(contract: AutoExpenseContract, referenceDate = new Date()) {
  if (!contract.autoCreateExpenses || contract.status !== "ACTIVE") return [];
  const phases = normalizedPhases(contract.pricePhases, {
    amountCents: contract.costCents,
    currency: contract.currency,
    billingInterval: contract.billingInterval,
    validFrom: contract.startDate
  });
  return getDueDatesForPhases({
    startDate: contract.startDate,
    endDate: contract.endDate,
    referenceDate,
    paymentDay: paymentDayForContract(contract),
    includeAfterEndDate: contract.autoRenewal,
    phases
  });
}

export function getDueRecurringTransactionDates(transaction: AutoExpenseRecurringTransaction, referenceDate = new Date()) {
  if (transaction.status !== "ACTIVE" || transaction.deletedAt) return [];
  return getDueDatesForPhases({
    startDate: transaction.startDate,
    endDate: transaction.endDate,
    referenceDate,
    paymentDay: startOfUtcDay(transaction.startDate).getUTCDate(),
    includeAfterEndDate: false,
    phases: normalizedPhases(transaction.pricePhases)
  });
}

export function getPricePhaseForDate(phases: PricePhaseLike[] | null | undefined, date: Date | string) {
  const dueDate = startOfUtcDay(date);
  return normalizedPhases(phases)
    .filter((phase) => {
      const validFrom = startOfUtcDay(phase.validFrom);
      const validTo = phase.validTo ? startOfUtcDay(phase.validTo) : null;
      return validFrom.getTime() <= dueDate.getTime() && (!validTo || dueDate.getTime() <= validTo.getTime());
    })
    .sort((a, b) => startOfUtcDay(b.validFrom).getTime() - startOfUtcDay(a.validFrom).getTime())[0] ?? null;
}

export function paymentDayForContract(contract: Pick<AutoExpenseContract, "startDate" | "expensePaymentDay">) {
  if (contract.expensePaymentDay && contract.expensePaymentDay >= 1 && contract.expensePaymentDay <= 31) {
    return contract.expensePaymentDay;
  }
  return startOfUtcDay(contract.startDate).getUTCDate();
}

export function addMonths(date: Date, months: number, paymentDay: number) {
  return buildClampedUtcDate(date.getUTCFullYear(), date.getUTCMonth() + months, paymentDay);
}

function getDueDatesForPhases({
  startDate,
  endDate,
  referenceDate,
  paymentDay,
  includeAfterEndDate,
  phases
}: {
  startDate: Date | string;
  endDate?: Date | string | null;
  referenceDate: Date;
  paymentDay: number;
  includeAfterEndDate: boolean;
  phases: PricePhaseLike[];
}) {
  if (phases.length === 0) return [];
  const firstPhase = phases[0];
  if (firstPhase.amountCents <= 0) return [];
  const intervalMonths = monthsForBillingInterval(firstPhase.billingInterval);
  if (intervalMonths === null) return [];

  const normalizedStartDate = startOfUtcDay(startDate);
  const normalizedEndDate = endDate ? startOfUtcDay(endDate) : null;
  const today = startOfUtcDay(referenceDate);
  if (normalizedStartDate.getTime() > today.getTime()) return [];

  let dueDate = buildClampedUtcDate(normalizedStartDate.getUTCFullYear(), normalizedStartDate.getUTCMonth(), paymentDay);
  if (dueDate.getTime() < normalizedStartDate.getTime()) {
    dueDate = addMonths(dueDate, intervalMonths, paymentDay);
  }

  const dates: Date[] = [];
  for (let guard = 0; guard < 600 && dueDate.getTime() <= today.getTime(); guard += 1) {
    const phase = getPricePhaseForDate(phases, dueDate);
    if (phase) {
      const currentInterval = monthsForBillingInterval(phase.billingInterval);
      if (currentInterval === null) break;
      if (!normalizedEndDate || includeAfterEndDate || dueDate.getTime() <= normalizedEndDate.getTime()) {
        dates.push(dueDate);
      }
      if (phase.billingInterval === "ONCE") break;
      dueDate = addMonths(dueDate, currentInterval, paymentDay);
    } else {
      dueDate = addMonths(dueDate, intervalMonths, paymentDay);
    }
  }
  return dates;
}

function normalizedPhases(phases: PricePhaseLike[] | null | undefined, fallback?: PricePhaseLike) {
  const source = phases && phases.length > 0 ? phases : fallback ? [fallback] : [];
  return [...source].sort((a, b) => startOfUtcDay(a.validFrom).getTime() - startOfUtcDay(b.validFrom).getTime());
}

function monthsForBillingInterval(interval: BillingInterval) {
  if (interval === "MONTHLY") return 1;
  if (interval === "QUARTERLY") return 3;
  if (interval === "YEARLY") return 12;
  if (interval === "ONCE") return 1;
  return null;
}

function buildClampedUtcDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay)));
}

function startOfUtcDay(value: Date | string) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
