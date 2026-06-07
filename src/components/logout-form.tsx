"use client";

import { LogOut } from "lucide-react";
import { clearOfflineData } from "@/lib/offline-sync";

type LogoutFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function LogoutForm({ action }: LogoutFormProps) {
  async function clearBrowserState() {
    try {
      await clearOfflineData();
    } catch {
      // Logout must still continue if IndexedDB is unavailable.
    }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("family-app-")).map((key) => caches.delete(key)));
    } catch {
      // Cache Storage can be unavailable in private or restricted browser modes.
    }
    try {
      navigator.serviceWorker?.controller?.postMessage({ type: "FAMILY_APP_CLEAR_AUTH_DATA" });
    } catch {
      // The current page may not be controlled by a service worker.
    }
  }

  return (
    <form action={action} onSubmit={() => { void clearBrowserState(); }}>
      <button className="button secondary button-icon" type="submit" aria-label="Logout" title="Logout">
        <LogOut size={17} />
        Logout
      </button>
    </form>
  );
}
