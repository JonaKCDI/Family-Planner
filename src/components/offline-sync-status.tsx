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
    let syncInFlight: Promise<void> | null = null;
    let scheduledSync: number | null = null;
    let rerunAfterCurrent = false;
    let disposed = false;
    const refresh = async () => {
      try { setSummary(await getOfflineSummary()); } catch { /* IndexedDB may be unavailable. */ }
    };
    const refreshFromEvent = () => {
      void refresh();
    };
    const sync = async () => {
      try {
        const reachable = await bootstrapOfflineCache();
        setServerReachable(reachable);
        if (!reachable) {
          await refresh();
          return;
        }
      } catch {
        setServerReachable(false);
        await refresh();
        return;
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
    const scheduleSync = () => {
      if (disposed) return;
      if (syncInFlight) { rerunAfterCurrent = true; return; }
      if (scheduledSync !== null) return;
      // Let the visible route paint before reconciling the full offline dataset.
      scheduledSync = window.setTimeout(() => {
        scheduledSync = null;
        syncInFlight = sync().finally(() => {
          syncInFlight = null;
          if (rerunAfterCurrent) { rerunAfterCurrent = false; scheduleSync(); }
        });
      }, 250);
    };
    const onOnline = () => {
      scheduleSync();
    };
    const onOffline = () => {
      setServerReachable(false);
      void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleSync();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("family-app-sync", refreshFromEvent);
    document.addEventListener("visibilitychange", onVisible);
    scheduleSync();

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("family-app-sync", refreshFromEvent);
      document.removeEventListener("visibilitychange", onVisible);
      window.cancelAnimationFrame(frame);
      if (scheduledSync !== null) window.clearTimeout(scheduledSync);
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
