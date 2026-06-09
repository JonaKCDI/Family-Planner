"use client";

type SyncEntity = "expense" | "task";
type SyncAction = "create" | "update" | "delete";

export type OfflineChange = {
  clientMutationId: string;
  entity: SyncEntity;
  action: SyncAction;
  entityId?: string;
  localId?: string;
  changedAt: string;
  data?: unknown;
  status: "pending" | "failed";
  message?: string;
};

type OfflineState = {
  serverTime?: string;
  lastSyncAt?: string;
  expenses?: unknown[];
  tasks?: unknown[];
  categories?: { id: string; name: string }[];
  labels?: { id: string; name: string }[];
  contracts?: { id: string; provider: string; contractType: string }[];
  members?: { userId: string; name: string }[];
};

const DB_NAME = "family-app-offline";
const DB_VERSION = 1;

export async function bootstrapOfflineCache() {
  if (!canUseIndexedDb()) return;
  const response = await fetch("/api/sync/bootstrap", { cache: "no-store" });
  if (!response.ok) return;
  const payload = await response.json() as OfflineState;
  await setState({ ...payload, lastSyncAt: payload.serverTime });
  emitSyncEvent();
}

export async function syncPendingChanges() {
  if (!canUseIndexedDb()) return;
  const changes = await getChanges();
  if (changes.length === 0) {
    await pullServerChanges();
    return;
  }

  const response = await fetch("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes })
  });
  if (!response.ok) {
    await markAllFailed(changes, "Server nicht erreichbar.");
    return;
  }

  const payload = await response.json() as {
    serverTime: string;
    results: { clientMutationId: string; ok: boolean; message?: string }[];
  };
  for (const result of payload.results) {
    if (result.ok) {
      await deleteChange(result.clientMutationId);
    } else {
      await updateChange(result.clientMutationId, { status: "failed", message: result.message ?? "Sync fehlgeschlagen." });
    }
  }
  await pullServerChanges(payload.serverTime);
  emitSyncEvent();
}

export async function enqueueOfflineExpenseCreate(formData: FormData) {
  if (!canUseIndexedDb()) return false;
  const state = await getState();
  if (!state.categories) return false;
  const localId = createLocalId("expense");
  await addChange({
    clientMutationId: createLocalId("mutation"),
    entity: "expense",
    action: "create",
    localId,
    changedAt: new Date().toISOString(),
    data: {
      id: localId,
      kind: enumValue(formData.get("kind"), ["EXPENSE", "INCOME"], "EXPENSE"),
      amountCents: parseEuroToCents(formData.get("amount")),
      currency: "EUR",
      date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
      paymentMethod: optionalText(formData.get("paymentMethod")) || "Nicht angegeben",
      store: optionalText(formData.get("store")) || "",
      categoryId: optionalText(formData.get("categoryId")),
      labelId: optionalText(formData.get("labelId")),
      contractId: optionalText(formData.get("contractId")),
      description: optionalText(formData.get("description")) || ""
    },
    status: "pending"
  });
  emitSyncEvent();
  return true;
}

export async function enqueueOfflineTaskCreate(formData: FormData) {
  if (!canUseIndexedDb()) return false;
  const state = await getState();
  if (!state.members) return false;
  const localId = createLocalId("task");
  await addChange({
    clientMutationId: createLocalId("mutation"),
    entity: "task",
    action: "create",
    localId,
    changedAt: new Date().toISOString(),
    data: {
      id: localId,
      title: optionalText(formData.get("title")) || "Offline-Aufgabe",
      assignedToUserId: optionalText(formData.get("assignedToUserId")),
      dueDate: optionalText(formData.get("dueDate")),
      priority: enumValue(formData.get("priority"), ["LOW", "MEDIUM", "HIGH", "URGENT"], "MEDIUM"),
      status: "OPEN",
      scope: enumValue(formData.get("scope"), ["PRIVATE", "FAMILY"], "FAMILY"),
      description: optionalText(formData.get("description"))
    },
    status: "pending"
  });
  emitSyncEvent();
  return true;
}

export async function enqueueOfflineTaskStatus(taskId: string, status: "OPEN" | "IN_PROGRESS" | "DONE" | "ARCHIVED") {
  if (!canUseIndexedDb()) return false;
  await addChange({
    clientMutationId: createLocalId("mutation"),
    entity: "task",
    action: "update",
    entityId: taskId,
    changedAt: new Date().toISOString(),
    data: {
      id: taskId,
      status
    },
    status: "pending"
  });
  emitSyncEvent();
  return true;
}

export async function getOfflineSummary() {
  if (!canUseIndexedDb()) return { pending: 0, failed: 0, lastSyncAt: undefined as string | undefined };
  const [changes, state] = await Promise.all([getChanges(), getState()]);
  return {
    pending: changes.filter((change) => change.status === "pending").length,
    failed: changes.filter((change) => change.status === "failed").length,
    lastSyncAt: state.lastSyncAt
  };
}

export async function clearOfflineData() {
  if (!canUseIndexedDb()) return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function pullServerChanges(serverTime?: string) {
  const state = await getState();
  const since = state.lastSyncAt ? `?since=${encodeURIComponent(state.lastSyncAt)}` : "";
  const response = await fetch(`/api/sync/pull${since}`, { cache: "no-store" });
  if (!response.ok) return;
  const payload = await response.json() as OfflineState;
  await setState({
    ...state,
    expenses: mergeById(state.expenses, payload.expenses),
    tasks: mergeById(state.tasks, payload.tasks),
    lastSyncAt: serverTime ?? payload.serverTime,
    serverTime: payload.serverTime
  });
}

function mergeById(current: unknown[] = [], incoming: unknown[] = []) {
  const merged = new Map<string, unknown>();
  for (const item of current) if (isRecord(item) && typeof item.id === "string") merged.set(item.id, item);
  for (const item of incoming) if (isRecord(item) && typeof item.id === "string") merged.set(item.id, item);
  return [...merged.values()];
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("state")) database.createObjectStore("state");
      if (!database.objectStoreNames.contains("changes")) database.createObjectStore("changes", { keyPath: "clientMutationId" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getState(): Promise<OfflineState> {
  const db = await openDb();
  return transaction<OfflineState>(db, "state", "readonly", (store) => store.get("current")).then((value) => value ?? {});
}

async function setState(state: OfflineState) {
  const db = await openDb();
  await transaction(db, "state", "readwrite", (store) => store.put(state, "current"));
}

async function getChanges(): Promise<OfflineChange[]> {
  const db = await openDb();
  return transaction<OfflineChange[]>(db, "changes", "readonly", (store) => store.getAll()).then((items) => items ?? []);
}

async function addChange(change: OfflineChange) {
  const db = await openDb();
  await transaction(db, "changes", "readwrite", (store) => store.put(change));
}

async function deleteChange(id: string) {
  const db = await openDb();
  await transaction(db, "changes", "readwrite", (store) => store.delete(id));
}

async function updateChange(id: string, patch: Partial<OfflineChange>) {
  const changes = await getChanges();
  const change = changes.find((item) => item.clientMutationId === id);
  if (!change) return;
  await addChange({ ...change, ...patch });
}

async function markAllFailed(changes: OfflineChange[], message: string) {
  await Promise.all(changes.map((change) => updateChange(change.clientMutationId, { status: "failed", message })));
  emitSyncEvent();
}

function transaction<T>(db: IDBDatabase, storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest) {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

function parseEuroToCents(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "0").replace(/\./g, "").replace(",", ".").trim();
  return Math.round(Number(normalized) * 100);
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function enumValue<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T) {
  const text = String(value ?? fallback) as T;
  return allowed.includes(text) ? text : fallback;
}

function createLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function emitSyncEvent() {
  window.dispatchEvent(new Event("family-app-sync"));
}
