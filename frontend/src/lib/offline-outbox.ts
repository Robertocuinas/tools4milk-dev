"use client";

import type { Task } from "@/lib/types";
import { API_V1_URL } from "@/lib/config";

export type SyncState = "online" | "offline" | "queued" | "syncing" | "conflict" | "failed" | "synced";
export type OutboxOperation = {
  operationId: string;
  taskId: string;
  body: Record<string, unknown>;
  expectedVersion: number;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  state: Exclude<SyncState, "online" | "offline">;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  sessionUserId?: string;
};
export type SyncMetrics = { queued: number; synced: number; deduplicated: number; conflicts: number; failed: number; retry_count: number };
const EMPTY_METRICS: SyncMetrics = { queued: 0, synced: 0, deduplicated: 0, conflicts: 0, failed: 0, retry_count: 0 };

const DB_NAME = "tools4milk-release2";
const DB_VERSION = 1;
const OUTBOX = "outbox";
const SNAPSHOTS = "task_snapshots";
const META = "sync_meta";

function supported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window && typeof crypto?.randomUUID === "function";
}

function openDb(): Promise<IDBDatabase> {
  if (!supported()) return Promise.reject(new Error("IndexedDB no disponible: las mutaciones offline están deshabilitadas"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "operationId" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transaction<T>(store: string, mode: IDBTransactionMode, action: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(store, mode).objectStore(store));
    request.onerror = () => reject(request.error ?? new Error("IndexedDB operation failed"));
    request.onsuccess = () => resolve(request.result);
  }));
}

export function canQueueOffline(): boolean { return supported(); }

export async function enqueueTaskMutation(task: Pick<Task, "id" | "version">, body: Record<string, unknown>, sessionUserId?: string, operationId = crypto.randomUUID()): Promise<OutboxOperation> {
  if (!supported()) throw new Error("Este navegador no permite cola offline; conecta para cambiar estados");
  const operation: OutboxOperation = {
    operationId, taskId: task.id, body: { ...body, expected_version: task.version },
    expectedVersion: task.version, createdAt: new Date().toISOString(), attempts: 0,
    nextAttemptAt: Date.now(), state: "queued", sessionUserId,
  };
  await transaction(OUTBOX, "readwrite", (store) => store.add(operation));
  await incrementMetric("queued");
  return operation;
}

export async function getSyncMetrics(): Promise<SyncMetrics> {
  if (!supported()) return { ...EMPTY_METRICS };
  return ((await transaction(META, "readonly", (store) => store.get("metrics")).catch(() => undefined)) as SyncMetrics | undefined) ?? { ...EMPTY_METRICS };
}

async function incrementMetric(metric: keyof SyncMetrics, amount = 1): Promise<void> {
  const current = await getSyncMetrics();
  current[metric] += amount;
  await transaction(META, "readwrite", (store) => store.put({ id: "metrics", ...current }));
}

export async function listOutbox(): Promise<OutboxOperation[]> {
  return (await transaction(OUTBOX, "readonly", (store) => store.getAll())) as OutboxOperation[];
}
export async function updateOutbox(operation: OutboxOperation): Promise<void> { await transaction(OUTBOX, "readwrite", (store) => store.put(operation)); }
export async function removeOutbox(operationId: string): Promise<void> { await transaction(OUTBOX, "readwrite", (store) => store.delete(operationId)); }

export async function clearOfflineData(): Promise<void> {
  if (!supported()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([OUTBOX, SNAPSHOTS, META], "readwrite");
    tx.objectStore(OUTBOX).clear(); tx.objectStore(SNAPSHOTS).clear(); tx.objectStore(META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo limpiar el almacenamiento offline"));
  });
}

export function backoffMs(attempts: number): number {
  const bounded = Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
  return bounded + Math.floor(Math.random() * 250);
}
export function nextStateFromStatus(status: number): OutboxOperation["state"] {
  if (status === 409) return "conflict";
  if (status === 401 || status === 403 || status === 404 || (status >= 400 && status < 500)) return "failed";
  return "queued";
}

export async function syncOutbox(onState?: (operation: OutboxOperation) => void): Promise<{ synced: number; pending: number; paused: boolean }> {
  if (!supported() || !navigator.onLine) return { synced: 0, pending: (await listOutbox().catch(() => [])).length, paused: false };
  const operations = (await listOutbox()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  let synced = 0; let paused = false;
  for (const operation of operations) {
    if (operation.state === "conflict" || operation.state === "failed" || operation.nextAttemptAt > Date.now()) continue;
    operation.state = "syncing"; onState?.(operation); await updateOutbox(operation);
    try {
      const response = await fetch(`${API_V1_URL}/tasks/${operation.taskId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json", "X-Operation-Id": operation.operationId },
        body: JSON.stringify(operation.body),
      });
      if (response.status === 401) {
        operation.state = "queued"; operation.lastErrorCode = "unauthorized";
        operation.lastErrorMessage = "Vuelve a iniciar sesión para sincronizar"; paused = true;
        await updateOutbox(operation); onState?.(operation); break;
      }
      if (response.ok) {
        const result = await response.clone().json().catch(() => ({})) as { replayed?: boolean };
        operation.state = "synced"; await updateOutbox(operation); await removeOutbox(operation.operationId);
        synced += 1; await incrementMetric(result.replayed ? "deduplicated" : "synced"); onState?.(operation); continue;
      }
      operation.state = nextStateFromStatus(response.status); operation.lastErrorCode = `http_${response.status}`;
      operation.lastErrorMessage = response.status === 409 ? "Conflicto: revisa el estado remoto" : `Sincronización rechazada (${response.status})`;
      await updateOutbox(operation); onState?.(operation);
      await incrementMetric(operation.state === "conflict" ? "conflicts" : "failed");
    } catch {
      operation.attempts += 1; operation.state = operation.attempts >= 5 ? "failed" : "queued";
      operation.nextAttemptAt = Date.now() + backoffMs(operation.attempts); operation.lastErrorCode = "network_error";
      operation.lastErrorMessage = operation.state === "failed" ? "Se agotaron los reintentos automáticos" : "Error de red; se reintentará";
      await updateOutbox(operation); onState?.(operation);
      await incrementMetric("retry_count");
    }
  }
  return { synced, pending: (await listOutbox()).length, paused };
}

export async function resetRelease2Database(): Promise<void> {
  if (!supported()) return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(request.error ?? new Error("No se pudo borrar la base offline"));
    request.onsuccess = () => resolve();
  });
}
