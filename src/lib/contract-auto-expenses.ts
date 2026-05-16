import { db } from "@/lib/db";

type BillingInterval = "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONCE" | "OTHER";
type ContractStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "DRAFT";

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
};

export async function ensureDueContractExpenses(familyId: string, userId: string, referenceDate = new Date()) {
  const contracts = await db.contract.findMany({
    where: {
      familyId,
      ownerUserId: userId,
      status: "ACTIVE",
      autoCreateExpenses: true,
      billingInterval: { in: ["MONTHLY", "QUARTERLY", "YEARLY", "ONCE"] }
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
    const missingDates = dueDates.filter((date) => !existingKeys.has(dateKey(date)));
    if (missingDates.length === 0) continue;

    await db.expense.createMany({
      data: missingDates.map((date) => ({
        familyId,
        ownerUserId: userId,
        kind: "EXPENSE",
        amountCents: contract.costCents,
        currency: contract.currency,
        date,
        paymentMethod: "Vertrag",
        store: contract.provider,
        contractId: contract.id,
        generatedByContract: true,
        description: `${contract.provider} · ${contract.contractType}`,
        scope: "PRIVATE"
      })),
      skipDuplicates: true
    });
  }
}

export function getDueContractExpenseDates(contract: AutoExpenseContract, referenceDate = new Date()) {
  if (!contract.autoCreateExpenses || contract.status !== "ACTIVE" || contract.costCents <= 0) return [];
  const intervalMonths = monthsForBillingInterval(contract.billingInterval);
  if (intervalMonths === null) return [];

  const startDate = startOfUtcDay(contract.startDate);
  const endDate = contract.endDate ? startOfUtcDay(contract.endDate) : null;
  const today = startOfUtcDay(referenceDate);
  if (startDate.getTime() > today.getTime()) return [];

  const paymentDay = paymentDayForContract(contract);
  let dueDate = buildClampedUtcDate(startDate.getUTCFullYear(), startDate.getUTCMonth(), paymentDay);
  if (dueDate.getTime() < startDate.getTime()) {
    dueDate = addMonths(dueDate, intervalMonths, paymentDay);
  }

  const dates: Date[] = [];
  for (let guard = 0; guard < 240 && dueDate.getTime() <= today.getTime(); guard += 1) {
    if (!endDate || contract.autoRenewal || dueDate.getTime() <= endDate.getTime()) {
      dates.push(dueDate);
    }
    if (contract.billingInterval === "ONCE") break;
    dueDate = addMonths(dueDate, intervalMonths, paymentDay);
  }
  return dates;
}

export function paymentDayForContract(contract: Pick<AutoExpenseContract, "startDate" | "expensePaymentDay">) {
  if (contract.expensePaymentDay && contract.expensePaymentDay >= 1 && contract.expensePaymentDay <= 31) {
    return contract.expensePaymentDay;
  }
  return startOfUtcDay(contract.startDate).getUTCDate();
}

function monthsForBillingInterval(interval: BillingInterval) {
  if (interval === "MONTHLY") return 1;
  if (interval === "QUARTERLY") return 3;
  if (interval === "YEARLY") return 12;
  if (interval === "ONCE") return 1;
  return null;
}

function addMonths(date: Date, months: number, paymentDay: number) {
  return buildClampedUtcDate(date.getUTCFullYear(), date.getUTCMonth() + months, paymentDay);
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
