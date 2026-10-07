"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

let openModalCount = 0;
let lockedScrollY = 0;

function unlockPageScroll() {
  document.documentElement.classList.remove("modal-scroll-locked");
  document.body.classList.remove("modal-scroll-locked");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
}

export function ModalPortal({ children }: { children: ReactNode }) {
  const target = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!target) return;
    if (openModalCount === 0) unlockPageScroll();
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
        unlockPageScroll();
        window.scrollTo(0, lockedScrollY);
      }
    };
  }, [target]);

  if (!target) return null;
  return createPortal(children, target);
}
