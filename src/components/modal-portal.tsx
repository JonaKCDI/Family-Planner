"use client";

import type { ReactNode } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

let openModalCount = 0;
let lockedScrollY = 0;

export function ModalPortal({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!target) return;
    openModalCount += 1;
    if (openModalCount === 1) {
      lockedScrollY = window.scrollY;
      document.documentElement.classList.add("modal-scroll-locked");
      document.body.classList.add("modal-scroll-locked");
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }

    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.documentElement.classList.remove("modal-scroll-locked");
        document.body.classList.remove("modal-scroll-locked");
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        window.scrollTo(0, lockedScrollY);
      }
    };
  }, [target]);

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
