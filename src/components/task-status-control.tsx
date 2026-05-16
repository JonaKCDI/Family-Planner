"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/lib/actions";
import { enqueueOfflineTaskStatus } from "@/lib/offline-sync";

type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

type TaskStatusControlProps = {
  taskId: string;
  initialStatus: TaskStatus;
};

const statusOptions = [
  { value: "OPEN", label: "Offen" },
  { value: "IN_PROGRESS", label: "In Arbeit" },
  { value: "DONE", label: "Erledigt" }
] satisfies { value: TaskStatus; label: string }[];

export function TaskStatusControl({ taskId, initialStatus }: TaskStatusControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(initialStatus === "ARCHIVED" ? "DONE" : initialStatus);
  const [isPending, startTransition] = useTransition();

  function changeStatus(nextStatus: TaskStatus) {
    if (nextStatus === status || isPending) return;
    setStatus(nextStatus);
    if (!navigator.onLine) {
      void enqueueOfflineTaskStatus(taskId, nextStatus);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", taskId);
      formData.set("status", nextStatus);
      await updateTaskStatus(formData);
      router.refresh();
    });
  }

  return (
    <label className="task-status-control">
      <span>Status</span>
      <div className="status-select-wrap">
        <select
          className={`status-select ${statusClassName(status)}`}
          value={status}
          disabled={isPending}
          onChange={(event) => changeStatus(event.currentTarget.value as TaskStatus)}
        >
          {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        {isPending ? <LoaderCircle className="spin status-select-spinner" size={16} /> : null}
      </div>
    </label>
  );
}

function statusClassName(status: TaskStatus) {
  if (status === "IN_PROGRESS") return "status-progress";
  if (status === "DONE" || status === "ARCHIVED") return "status-done";
  return "status-open";
}
