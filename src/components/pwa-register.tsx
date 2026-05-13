"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {
          // Development should keep working even if cleanup is blocked.
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA should never block the app if registration fails.
    });
  }, []);

  return null;
}
