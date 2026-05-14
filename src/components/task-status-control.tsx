"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, LoaderCircle, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/lib/actions";
import { enqueueOfflineTaskStatus } from "@/lib/offline-sync";

type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

type TaskStatusControlProps = {
  taskId: string;
  initialStatus: TaskStatus;
};

const statusOptions = [
  { value: "OPEN", label: "Offen", className: "status-open", icon: Circle },
  { value: "IN_PROGRESS", label: "In Arbeit", className: "status-progress", icon: PlayCircle },
  { value: "DONE", label: "Erledigt", className: "status-done", icon: CheckCircle2 }
] satisfies { value: TaskStatus; label: string; className: string; icon: typeof Circle }[];

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
    <div className="task-status-control" role="radiogroup" aria-label="Aufgabenstatus">
      {statusOptions.map((option) => (
        <button
          className={`status-option ${option.className}${status === option.value ? " active" : ""}`}
          type="button"
          role="radio"
          aria-checked={status === option.value}
          disabled={isPending}
          onClick={() => changeStatus(option.value)}
          key={option.value}
        >
          {isPending && status === option.value ? <LoaderCircle className="spin" size={16} /> : <option.icon size={16} />}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
