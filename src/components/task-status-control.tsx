"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/lib/actions";
import { enqueueOfflineTaskStatus } from "@/lib/offline-sync";

type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

type TaskStatusControlProps = {
  taskId: string;
  initialStatus: TaskStatus;
};

export function TaskStatusControl({ taskId, initialStatus }: TaskStatusControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(initialStatus === "ARCHIVED" ? "DONE" : initialStatus);
  const [isPending, startTransition] = useTransition();
  const tone = taskStatusTone(status);

  return (
    <div className="task-status-control">
      <select
        name="status"
        value={status}
        className={`status-select ${tone.className}`}
        disabled={isPending}
        onChange={(event) => {
          const nextStatus = event.currentTarget.value as TaskStatus;
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
        }}
      >
        <option value="OPEN">Offen</option>
        <option value="IN_PROGRESS">In Arbeit</option>
        <option value="DONE">Erledigt</option>
      </select>
    </div>
  );
}

function taskStatusTone(status: TaskStatus) {
  if (status === "IN_PROGRESS") return { label: "In Arbeit", className: "status-progress" };
  if (status === "DONE" || status === "ARCHIVED") return { label: "Erledigt", className: "status-done" };
  return { label: "Offen", className: "status-open" };
}
