"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export function ModalPortal({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!target) return null;
  return createPortal(children, target);
}

function subscribe() {
  return () => undefined;
}

function getSnapshot() {
  return document.body;
}

function getServerSnapshot() {
  return null;
}
