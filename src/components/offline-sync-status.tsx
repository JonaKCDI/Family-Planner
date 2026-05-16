"use client";

import { useEffect, useState } from "react";
import { bootstrapOfflineCache, getOfflineSummary, syncPendingChanges } from "@/lib/offline-sync";

type Summary = {
  pending: number;
  failed: number;
  lastSyncAt?: string;
};

export function OfflineSyncStatus() {
  const [summary, setSummary] = useState<Summary>({ pending: 0, failed: 0 });
  const [serverReachable, setServerReachable] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    const refresh = async () => setSummary(await getOfflineSummary());
    const refreshFromEvent = () => {
      void refresh();
    };
    const sync = async () => {
      const reachable = await probeSyncServer();
      setServerReachable(reachable);
      if (!reachable) {
        await refresh();
        return;
      }
      try {
        await bootstrapOfflineCache();
      } catch {
        // IndexedDB or payload issues should not make the app look offline.
      }
      try {
        await syncPendingChanges();
      } catch {
        // Pending changes remain queued and visible through the summary.
      }
      try {
        await refresh();
      } catch {
        // Local offline storage may be unavailable in private/locked-down browsers.
      }
    };
    const onOnline = () => {
      void sync();
    };
    const onOffline = () => {
        setServerReachable(false);
      void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("family-app-sync", refreshFromEvent);
    document.addEventListener("visibilitychange", onVisible);
    void sync();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("family-app-sync", refreshFromEvent);
      document.removeEventListener("visibilitychange", onVisible);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!mounted || (serverReachable && summary.pending === 0 && summary.failed === 0)) {
    return <div className="sync-status-slot" aria-hidden="true" />;
  }

  return (
    <div className={summary.failed > 0 ? "sync-status sync-status-error" : "sync-status"}>
      <strong>{serverReachable ? "Sync" : "Offline"}</strong>
      <span>
        {summary.failed > 0
          ? `${summary.failed} fehlgeschlagen`
          : summary.pending > 0
            ? `${summary.pending} wartet auf Sync beim nächsten Online-Start`
            : "Neue Ausgaben, neue Aufgaben und Aufgabenstatus sind offline möglich"}
      </span>
      {serverReachable && summary.pending > 0 ? <button type="button" onClick={() => void syncPendingChanges()}>Jetzt syncen</button> : null}
    </div>
  );
}

async function probeSyncServer() {
  try {
    await fetch("/api/sync/bootstrap", { cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}
