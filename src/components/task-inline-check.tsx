"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/lib/actions";
import { enqueueOfflineTaskStatus } from "@/lib/offline-sync";

type TaskStatus = "OPEN" | "DONE";

type TaskInlineCheckProps = {
  taskId: string;
  done: boolean;
};

export function TaskInlineCheck({ taskId, done }: TaskInlineCheckProps) {
  const router = useRouter();
  const [visualDone, setVisualDone] = useState(done);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleTaskStatus() {
    if (isPending) return;
    const nextDone = !visualDone;
    const nextStatus: TaskStatus = nextDone ? "DONE" : "OPEN";
    setVisualDone(nextDone);
    setIsAnimating(true);
    window.setTimeout(() => setIsAnimating(false), 260);

    if (!navigator.onLine) {
      void enqueueOfflineTaskStatus(taskId, nextStatus);
      return;
    }

    window.setTimeout(() => {
      startTransition(async () => {
        const formData = new FormData();
        formData.set("id", taskId);
        formData.set("status", nextStatus);
        await updateTaskStatus(formData);
        router.refresh();
      });
    }, 220);
  }

  return (
    <button
      className={`task-check-button ${visualDone ? "is-done" : ""} ${isAnimating ? "is-animating" : ""}`}
      type="button"
      aria-pressed={visualDone}
      aria-label={visualDone ? "Aufgabe wieder öffnen" : "Aufgabe als erledigt markieren"}
      disabled={isPending}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        toggleTaskStatus();
      }}
    />
  );
}
