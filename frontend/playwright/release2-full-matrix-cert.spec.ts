import { expect, test } from "@playwright/test";
import { requireDemoPassword } from "./demo-credentials";

test("Release 2 complete offline/API/browser matrix", async ({ browser }) => {
  const password = requireDemoPassword();
  const context = await browser.newContext();
  const page = await context.newPage();

  const login = await context.request.post("/api/v1/auth/login", { data: { username: "admin", password } });
  expect(login.status()).toBe(200);
  await page.goto("/leanfarming", { waitUntil: "networkidle" });
  await expect(page.getByRole("status")).toContainText(/Conectado/);

  const tasksResponse = await context.request.get("/api/v1/tasks?limit=10");
  expect(tasksResponse.status()).toBe(200);
  const tasks = await tasksResponse.json();
  const pendingTasks = tasks.filter((candidate: { estado: string }) => ["pendiente", "programada"].includes(candidate.estado));
  const task = pendingTasks[0];
  const offlineTask = pendingTasks[1];
  expect(task?.id).toBeTruthy();
  expect(offlineTask?.id).toBeTruthy();

  const unauthorized = await browser.newContext();
  expect((await unauthorized.request.get("/api/v1/tasks")).status()).toBe(401);
  await unauthorized.close();


  const invalidOperation = await context.request.put(`/api/v1/tasks/${task.id}`, {
    headers: { "X-Operation-Id": "not-a-uuid" },
    data: { estado: "ejecutada", expected_version: task.version },
  });
  expect(invalidOperation.status()).toBe(422);

  const firstMutation = await context.request.put(`/api/v1/tasks/${task.id}`, {
    headers: { "X-Operation-Id": crypto.randomUUID() },
    data: { estado: "ejecutada", expected_version: task.version },
  });
  expect(firstMutation.status()).toBe(200);
  const stale = await context.request.put(`/api/v1/tasks/${task.id}`, {
    headers: { "X-Operation-Id": crypto.randomUUID() },
    data: { estado: "ejecutada", expected_version: task.version },
  });
  expect(stale.status()).toBe(409);

  const contextTwo = await browser.newContext();
  const secondPage = await contextTwo.newPage();
  await secondPage.goto("/", { waitUntil: "domcontentloaded" });
  expect(await secondPage.evaluate(() => localStorage.length)).toBe(0);
  await contextTwo.close();

  await page.getByRole("button", { name: "Lista" }).click();
  // El seed canonico R3 (scheduler small/normal) materializa tareas
  // programadas sin retrasadas, y la vista Lista abre por defecto en la
  // pestana "Retrasadas" (vacia). Se selecciona "Programadas" para ejercer
  // el flujo offline sobre tareas completables del seed, sin cambiar asserts.
  await page.getByRole("button", { name: /Programadas/ }).click();
  await expect(page.locator('button[title="Completar tarea"]').first()).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText(/Sin conexión/);
  const beforeCount = await page.locator('button[title="Completar tarea"]').count();
  expect(beforeCount).toBeGreaterThan(0);
  const operationId = crypto.randomUUID();
  await page.evaluate(async ({ operationId, taskId, version }) => {
    const request = indexedDB.open("tools4milk-release2", 1);
    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "operationId" });
        if (!db.objectStoreNames.contains("sync_meta")) db.createObjectStore("sync_meta", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
    const db = request.result;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["outbox", "sync_meta"], "readwrite");
      tx.objectStore("outbox").put({ operationId, taskId, body: { estado: "ejecutada", expected_version: version }, expectedVersion: version, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: Date.now(), state: "queued" });
      tx.objectStore("sync_meta").put({ id: "metrics", queued: 1, synced: 0, deduplicated: 0, conflicts: 0, failed: 0, retry_count: 0 });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  }, { operationId, taskId: offlineTask.id, version: offlineTask.version });

  const queued = await page.evaluate(async () => {
    const request = indexedDB.open("tools4milk-release2", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(["outbox", "sync_meta"], "readonly");
    const outbox = await new Promise<unknown[]>((resolve, reject) => { const r = tx.objectStore("outbox").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const meta = await new Promise<unknown>((resolve, reject) => { const r = tx.objectStore("sync_meta").get("metrics"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return { outbox, meta };
  });
  expect(queued.outbox).toHaveLength(1);
  expect(queued.outbox[0]).toMatchObject({ state: "queued", attempts: 0 });
  expect(queued.meta).toMatchObject({ queued: 1 });

  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
  const persisted = await page.evaluate(async () => {
    const request = indexedDB.open("tools4milk-release2", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(["outbox", "sync_meta"], "readonly");
    const outbox = await new Promise<unknown[]>((resolve, reject) => { const r = tx.objectStore("outbox").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const meta = await new Promise<unknown>((resolve, reject) => { const r = tx.objectStore("sync_meta").get("metrics"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return { outbox, meta };
  });
  expect(persisted.outbox).toHaveLength(1);
  expect(persisted.meta).toMatchObject({ queued: 1, synced: 0, deduplicated: 0, conflicts: 0, failed: 0, retry_count: 0 });

  await context.setOffline(false);
  await page.goto("/tv", { waitUntil: "networkidle" });
  await expect(page.getByText(/TV|Control/).first()).toBeVisible();
  expect(await page.locator('button[title*="Completar"], button[title*="Editar"], button[title*="Eliminar"]').count()).toBe(0);

  await page.goto("/leanfarming", { waitUntil: "networkidle" });
  const synced = await page.evaluate(async () => {
    const request = indexedDB.open("tools4milk-release2", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(["outbox", "sync_meta"], "readonly");
    const outbox = await new Promise<unknown[]>((resolve, reject) => { const r = tx.objectStore("outbox").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const meta = await new Promise<{ queued: number; synced: number; deduplicated: number; conflicts: number; failed: number; retry_count: number }>((resolve, reject) => { const r = tx.objectStore("sync_meta").get("metrics"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return { outbox, meta };
  });
  expect(synced.outbox).toHaveLength(0);
  expect(synced.meta).toMatchObject({ queued: 1 });
  expect((synced.meta.synced ?? 0) + (synced.meta.deduplicated ?? 0)).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => indexedDB.deleteDatabase("tools4milk-release2"));
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL("/", { timeout: 10_000 });
  expect(await page.context().cookies()).toEqual([]);
  await context.close();
});

test("IndexedDB unavailable shows explicit degraded mode", async ({ browser }) => {
  const password = requireDemoPassword();
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: false, get: () => undefined });
  });
  const page = await context.newPage();
  expect((await context.request.post("/api/v1/auth/login", { data: { username: "admin", password } })).status()).toBe(200);
  await page.goto("/leanfarming", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toContainText(/Modo degradado/);
  await context.close();
});
