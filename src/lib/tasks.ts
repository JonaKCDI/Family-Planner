export type TaskPriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatusValue = "OPEN" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
export type RecurringTaskIntervalUnitValue = "DAY" | "MONTH" | "YEAR";
export type RecurringTaskStatusValue = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type TaskImportanceInput = {
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  dueDate: Date | string | null;
};

export function taskRank(task: TaskImportanceInput) {
  if (task.status === "DONE" || task.status === "ARCHIVED") return -1000;
  return statusWeight(task.status) + priorityWeight[task.priority] + dueDateWeight(task.dueDate);
}

export function isImportantTask(task: TaskImportanceInput) {
  const days = daysUntil(task.dueDate);
  if (task.status === "DONE" || task.status === "ARCHIVED") return false;
  if (days <= 0) return true;
  if (task.priority === "URGENT") return true;
  if (task.priority === "HIGH" && days <= 14) return true;
  if (task.status === "IN_PROGRESS" && days <= 7) return true;
  return false;
}

export function taskUrgency(task: TaskImportanceInput) {
  const days = daysUntil(task.dueDate);
  if (task.status === "DONE" || task.status === "ARCHIVED") {
    return { label: "Erledigt", className: "task-completed", chipClass: "status-done" };
  }
  if (days < 0) return { label: "Überfällig", className: "task-critical", chipClass: "danger-chip" };
  if (days === 0) return { label: "Heute fällig", className: "task-critical", chipClass: "danger-chip" };
  if (task.priority === "URGENT") return { label: "Dringend", className: "task-critical", chipClass: "danger-chip" };
  if (days <= 3) return { label: "Bald fällig", className: "task-warning", chipClass: "warning-chip" };
  if (task.priority === "HIGH" && days <= 14) return { label: "Wichtig", className: "task-warning", chipClass: "warning-chip" };
  if (task.status === "IN_PROGRESS") return { label: "In Arbeit", className: "task-calm", chipClass: "calm-chip" };
  return { label: "Planbar", className: "task-calm", chipClass: "calm-chip" };
}

export function daysUntil(date: Date | string | null | undefined) {
  if (!date) return 999;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(date));
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function statusWeight(status: TaskStatusValue) {
  return status === "IN_PROGRESS" ? 80 : 40;
}

function dueDateWeight(date: Date | string | null) {
  const days = daysUntil(date);
  if (days < 0) return 100;
  if (days === 0) return 90;
  if (days <= 2) return 70;
  if (days <= 7) return 42;
  if (days <= 14) return 20;
  if (days <= 30) return 6;
  return 0;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const priorityWeight = {
  LOW: 2,
  MEDIUM: 12,
  HIGH: 28,
  URGENT: 55
};

export type RecurringTaskPlanInput = {
  startDate: Date | string;
  endDate?: Date | string | null;
  nextDueDate?: Date | string | null;
  intervalCount: number;
  intervalUnit: RecurringTaskIntervalUnitValue;
  leadTimeDays: number;
  status?: RecurringTaskStatusValue;
};

export function defaultRecurringTaskLeadTimeDays(intervalCount: number, intervalUnit: RecurringTaskIntervalUnitValue) {
  if (intervalUnit === "DAY") return intervalCount >= 7 ? 2 : 0;
  if (intervalUnit === "MONTH") return 7;
  return 30;
}

export function getRecurringTaskGenerationDecision(plan: RecurringTaskPlanInput, referenceDate = new Date()) {
  const normalized = normalizeRecurringTaskPlan(plan);
  const reference = startOfUtcDay(referenceDate);
  const windowEnd = addUtcDays(reference, normalized.leadTimeDays);

  if (normalized.status && normalized.status !== "ACTIVE") {
    return { shouldGenerate: false, dueDate: null, nextDueDate: normalized.nextDueDate, windowEnd };
  }

  if (normalized.endDate && reference.getTime() > normalized.endDate.getTime()) {
    return { shouldGenerate: false, dueDate: null, nextDueDate: null, windowEnd };
  }

  if (normalized.nextDueDate && normalized.nextDueDate.getTime() > windowEnd.getTime()) {
    return { shouldGenerate: false, dueDate: null, nextDueDate: normalized.nextDueDate, windowEnd };
  }

  const latestAllowed = normalized.endDate && normalized.endDate.getTime() < windowEnd.getTime()
    ? normalized.endDate
    : windowEnd;
  const candidate = latestOccurrenceOnOrBefore(normalized, latestAllowed);
  if (!candidate) {
    const nextDueDate = normalized.endDate && normalized.startDate.getTime() > normalized.endDate.getTime()
      ? null
      : normalized.startDate;
    return { shouldGenerate: false, dueDate: null, nextDueDate, windowEnd };
  }

  const nextDueDate = getNextRecurringTaskDateAfter(normalized, candidate);
  return {
    shouldGenerate: true,
    dueDate: candidate,
    nextDueDate,
    windowEnd
  };
}

export function getNextRecurringTaskDateAfter(plan: RecurringTaskPlanInput, afterDate: Date | string) {
  const normalized = normalizeRecurringTaskPlan(plan);
  const latestIndex = occurrenceIndexOnOrBefore(normalized, startOfUtcDay(afterDate));
  const next = occurrenceAt(normalized, latestIndex + 1);
  if (normalized.endDate && next.getTime() > normalized.endDate.getTime()) return null;
  return next;
}

export function getRecurringTaskIntervalLabel(plan: Pick<RecurringTaskPlanInput, "intervalCount" | "intervalUnit">) {
  if (plan.intervalUnit === "DAY") {
    if (plan.intervalCount === 1) return "Täglich";
    if (plan.intervalCount === 2) return "Alle 2 Tage";
    if (plan.intervalCount === 7) return "Wöchentlich";
    if (plan.intervalCount === 14) return "Alle 2 Wochen";
    if (plan.intervalCount % 7 === 0) return `Alle ${plan.intervalCount / 7} Wochen`;
    return `Alle ${plan.intervalCount} Tage`;
  }
  if (plan.intervalUnit === "MONTH") {
    if (plan.intervalCount === 1) return "Monatlich";
    if (plan.intervalCount === 3) return "Vierteljährlich";
    if (plan.intervalCount === 6) return "Halbjährlich";
    return `Alle ${plan.intervalCount} Monate`;
  }
  if (plan.intervalCount === 1) return "Jährlich";
  return `Alle ${plan.intervalCount} Jahre`;
}

function normalizeRecurringTaskPlan(plan: RecurringTaskPlanInput) {
  return {
    ...plan,
    startDate: startOfUtcDay(plan.startDate),
    endDate: plan.endDate ? startOfUtcDay(plan.endDate) : null,
    nextDueDate: plan.nextDueDate ? startOfUtcDay(plan.nextDueDate) : null,
    intervalCount: Math.max(1, Math.floor(plan.intervalCount || 1)),
    leadTimeDays: Math.max(0, Math.floor(plan.leadTimeDays || 0))
  };
}

function latestOccurrenceOnOrBefore(plan: ReturnType<typeof normalizeRecurringTaskPlan>, date: Date) {
  const target = startOfUtcDay(date);
  if (target.getTime() < plan.startDate.getTime()) return null;
  const index = occurrenceIndexOnOrBefore(plan, target);
  return occurrenceAt(plan, index);
}

function occurrenceIndexOnOrBefore(plan: ReturnType<typeof normalizeRecurringTaskPlan>, date: Date) {
  if (plan.intervalUnit === "DAY") {
    const days = Math.floor((date.getTime() - plan.startDate.getTime()) / 86400000);
    return Math.max(0, Math.floor(days / plan.intervalCount));
  }

  let low = 0;
  let high = 1;
  while (occurrenceAt(plan, high).getTime() <= date.getTime() && high < 10000) {
    high *= 2;
  }

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (occurrenceAt(plan, mid).getTime() <= date.getTime()) low = mid;
    else high = mid - 1;
  }
  return low;
}

function occurrenceAt(plan: ReturnType<typeof normalizeRecurringTaskPlan>, index: number) {
  if (plan.intervalUnit === "DAY") return addUtcDays(plan.startDate, index * plan.intervalCount);
  if (plan.intervalUnit === "MONTH") return addUtcMonths(plan.startDate, index * plan.intervalCount);
  return addUtcMonths(plan.startDate, index * plan.intervalCount * 12);
}

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function addUtcMonths(date: Date, months: number) {
  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay)));
}

function startOfUtcDay(value: Date | string) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
