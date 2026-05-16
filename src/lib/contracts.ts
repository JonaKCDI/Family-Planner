export type AnnualCancellationDeadline = {
  month: number;
  day: number;
  nextDate: Date;
};

export type ContractCancellationInput = {
  annualDeadline: string | null | undefined;
  endDate: string | null | undefined;
  noticeDays: number | null | undefined;
  autoRenewal?: boolean;
  renewalInterval?: RenewalInterval | null;
  renewalAnchorDay?: number | null;
  referenceDate?: Date;
};

export type RenewalInterval = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type CancellationContractLike = {
  endDate: Date | string | null;
  cancellationNoticeDays: number | null;
  cancellationDeadlineMonth: number | null;
  cancellationDeadlineDay: number | null;
  autoRenewal?: boolean;
  renewalInterval?: string | null;
  renewalAnchorDay?: number | null;
  nextCancellationDate?: Date | string | null;
};

export type ContractCancellationSchedule = {
  deadlineMonth: number | null;
  deadlineDay: number | null;
  renewalAnchorDay: number | null;
  nextDate: Date | null;
};

export function resolveContractCancellationSchedule(input: ContractCancellationInput): ContractCancellationSchedule {
  const annual = parseAnnualCancellationDeadline(input.annualDeadline, input.referenceDate);
  if (annual) {
    return {
      deadlineMonth: annual.month,
      deadlineDay: annual.day,
      renewalAnchorDay: renewalAnchorDayFromInput(input),
      nextDate: annual.nextDate
    };
  }

  const renewalAnchorDay = renewalAnchorDayFromInput(input);

  return {
    deadlineMonth: null,
    deadlineDay: null,
    renewalAnchorDay,
    nextDate: input.autoRenewal
      ? calculateNextRenewalCancellationDate(input.endDate, input.noticeDays, input.renewalInterval, renewalAnchorDay, input.referenceDate)
      : calculateCancellationDateFromEndDate(input.endDate, input.noticeDays)
  };
}

export function getContractNextCancellationDate(contract: CancellationContractLike, referenceDate = new Date()) {
  if (contract.cancellationDeadlineMonth && contract.cancellationDeadlineDay) {
    return getNextAnnualCancellationDate(contract.cancellationDeadlineMonth, contract.cancellationDeadlineDay, referenceDate);
  }

  if (contract.autoRenewal) {
    return calculateNextRenewalCancellationDate(
      toInputDateOrNull(contract.endDate),
      contract.cancellationNoticeDays,
      normalizeRenewalInterval(contract.renewalInterval),
      contract.renewalAnchorDay ?? renewalAnchorDayFromDate(contract.endDate),
      referenceDate
    );
  }

  return contract.nextCancellationDate ? new Date(contract.nextCancellationDate) : calculateCancellationDateFromEndDate(toInputDateOrNull(contract.endDate), contract.cancellationNoticeDays);
}

export function parseAnnualCancellationDeadline(value: string | null | undefined, referenceDate = new Date()): AnnualCancellationDeadline | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidMonthDay(month, day)) return null;

  return {
    month,
    day,
    nextDate: getNextAnnualCancellationDate(month, day, referenceDate)
  };
}

export function getNextAnnualCancellationDate(month: number, day: number, referenceDate = new Date()) {
  const reference = startOfDay(referenceDate);
  const currentYearCandidate = buildClampedDate(reference.getFullYear(), month, day);
  if (currentYearCandidate.getTime() >= reference.getTime()) return currentYearCandidate;
  return buildClampedDate(reference.getFullYear() + 1, month, day);
}

export function toAnnualCancellationInputValue(
  month: number | null | undefined,
  day: number | null | undefined,
  fallbackDate?: Date | string | null
) {
  if (month && day) return toInputDate(getNextAnnualCancellationDate(month, day));
  if (fallbackDate) return toInputDate(fallbackDate);
  return "";
}

function isValidMonthDay(month: number, day: number) {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function buildClampedDate(year: number, month: number, day: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateCancellationDateFromEndDate(endDate: string | null | undefined, noticeDays: number | null | undefined) {
  if (!endDate || noticeDays === null || noticeDays === undefined) return null;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - noticeDays);
  return date;
}

function calculateNextRenewalCancellationDate(
  endDate: string | null | undefined,
  noticeDays: number | null | undefined,
  renewalInterval: RenewalInterval | null | undefined,
  renewalAnchorDay: number | null,
  referenceDate = new Date()
) {
  if (!endDate || noticeDays === null || noticeDays === undefined || !renewalAnchorDay) return null;
  const firstEndDate = new Date(endDate);
  if (Number.isNaN(firstEndDate.getTime())) return null;

  const reference = startOfDay(referenceDate);
  const intervalMonths = monthsForRenewalInterval(renewalInterval);
  let cycleEnd = buildClampedDate(firstEndDate.getFullYear(), firstEndDate.getMonth() + 1, renewalAnchorDay);

  for (let iteration = 0; iteration < 600; iteration += 1) {
    const cancellationDate = subtractDays(cycleEnd, noticeDays);
    if (cancellationDate.getTime() >= reference.getTime()) return cancellationDate;
    cycleEnd = buildClampedDate(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1 + intervalMonths, renewalAnchorDay);
  }

  return null;
}

function renewalAnchorDayFromInput(input: ContractCancellationInput) {
  if (input.renewalAnchorDay && input.renewalAnchorDay >= 1 && input.renewalAnchorDay <= 31) return input.renewalAnchorDay;
  return renewalAnchorDayFromDate(input.endDate ?? null);
}

function renewalAnchorDayFromDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const endDate = new Date(value);
  if (Number.isNaN(endDate.getTime())) return null;
  return endDate.getDate();
}

function monthsForRenewalInterval(value: RenewalInterval | null | undefined) {
  if (value === "YEARLY") return 12;
  if (value === "QUARTERLY") return 3;
  return 1;
}

function subtractDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function normalizeRenewalInterval(value: string | null | undefined): RenewalInterval {
  return value === "YEARLY" || value === "QUARTERLY" ? value : "MONTHLY";
}

function toInputDateOrNull(value: Date | string | null | undefined) {
  return value ? toInputDate(value) : null;
}

function toInputDate(date: Date | string) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
