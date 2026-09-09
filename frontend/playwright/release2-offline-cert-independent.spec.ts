import { expect, test } from "@playwright/test";
import { requireDemoPassword } from "./demo-credentials";

test("independent Chromium offline persistence and storage contract", async ({ browser }) => {
  const password = requireDemoPassword();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"]').fill("admin");
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/dashboard/);
  await page.goto("/leanfarming", { waitUntil: "networkidle" });

  const before = await page.evaluate(() => ({
    online: navigator.onLine,
    indexedDb: "indexedDB" in window,
    storage: [...Object.entries(localStorage), ...Object.entries(sessionStorage)],
  }));
  expect(before.indexedDb).toBe(true);
  expect(JSON.stringify(before.storage).toLowerCase()).not.toMatch(/token|password|email|access_token|refresh_token/);

  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión/)).toBeVisible({ timeout: 10_000 });
  const operationId = crypto.randomUUID();
  await page.evaluate(async ({ operationId }) => {
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
      tx.objectStore("outbox").put({ operationId, taskId: "synthetic-task", body: { estado: "ejecutada", expected_version: 1 }, expectedVersion: 1, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: Date.now(), state: "queued" });
      tx.objectStore("sync_meta").put({ id: "metrics", queued: 1, synced: 0, deduplicated: 0, conflicts: 0, failed: 0, retry_count: 0 });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  }, { operationId });
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
  const persisted = await page.evaluate(async (operationId) => {
    const dbRequest = indexedDB.open("tools4milk-release2", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { dbRequest.onsuccess = () => resolve(dbRequest.result); dbRequest.onerror = () => reject(dbRequest.error); });
    const tx = db.transaction(["outbox", "sync_meta"], "readonly");
    const item = await new Promise<unknown>((resolve, reject) => { const r = tx.objectStore("outbox").get(operationId); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const metrics = await new Promise<unknown>((resolve, reject) => { const r = tx.objectStore("sync_meta").get("metrics"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return { item, metrics };
  }, operationId);
  expect(persisted.item).toMatchObject({ operationId, state: "queued" });
  expect(persisted.metrics).toMatchObject({ queued: 1, synced: 0, deduplicated: 0, conflicts: 0, failed: 0, retry_count: 0 });

  await context.setOffline(false);
  await page.goto("/tv", { waitUntil: "networkidle" });
  await expect(page.getByText(/TV|Control/).first()).toBeVisible();
  const tvMutations = await page.locator('button[title*="Completar"], button[title*="Editar"], button[title*="Eliminar"]').count();
  expect(tvMutations).toBe(0);
  await context.close();
});
