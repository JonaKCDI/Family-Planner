export type TaskPriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatusValue = "OPEN" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

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
