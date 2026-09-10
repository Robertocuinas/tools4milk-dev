import { expect, test } from "@playwright/test";

// R4-4: panel operativo seguro en /integration (solo admin).
// Scheduler sintético (status/pause/resume), reset con doble confirmación y
// weather sync opcional. Sin secretos expuestos ni reset de infraestructura.

const adminMe = { id: "user-admin", username: "admin", email: "admin@example.invalid", activo: true, role: "admin" };
const operarioMe = { id: "user-op", username: "op", email: "op@example.invalid", activo: true, role: "operario" };

const health = { status: "ok", database: "ok", environment: "test" };
const weatherCurrent = { temperatura_actual: 18.5, descripcion: "Despejado", fuente: "generated" };

const schedulerActive = {
  paused: false,
  last_execution: {
    started_at: "2026-09-10T06:00:00",
    finished_at: "2026-09-10T06:00:05",
    duration_ms: 5000,
    created: 12,
    skipped: 0,
    errors: 0,
    error: null,
  },
};

const syncGenerated = {
  status: "success",
  modo: "generated",
  registros_insertados: 7,
  registros_actualizados: 0,
  timestamp: "2026-09-10T06:00:00",
  source: "generated",
  mode: "synthetic",
  synthetic: true,
};

test("admin opera scheduler, resetea con confirmación y sincroniza meteo", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json(adminMe);
      return;
    }
    if (url.pathname.endsWith("/admin/synthetic/scheduler/pause")) {
      await json({ ...schedulerActive, paused: true });
      return;
    }
    if (url.pathname.endsWith("/admin/synthetic/scheduler/resume")) {
      await json(schedulerActive);
      return;
    }
    if (url.pathname.endsWith("/admin/synthetic/scheduler")) {
      await json(schedulerActive);
      return;
    }
    if (url.pathname.endsWith("/admin/synthetic/reset")) {
      await json({ tasks: 12, recurrences: 6, provenance: 18, operation_dedupe: 0 });
      return;
    }
    if (url.pathname.endsWith("/weather/sync")) {
      await json(syncGenerated);
      return;
    }
    if (url.pathname.endsWith("/weather/current")) {
      await json(weatherCurrent);
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });
  await page.route("**/health", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(health) }),
  );

  await page.goto("/integration");
  await expect(page.getByRole("heading", { name: "Integración API" })).toBeVisible();

  // Scheduler: estado activo visible y pausa disponible.
  await expect(page.getByText("Scheduler sintético")).toBeVisible();
  await expect(page.getByText("Activo").first()).toBeVisible();
  await expect(page.getByText("Creadas / omitidas")).toBeVisible();
  await page.getByRole("button", { name: "Pausar scheduler" }).click();
  await expect(page.getByText("Scheduler sintético pausado")).toBeVisible();

  // Reset: exige confirmación explícita y muestra el resultado.
  await page.getByRole("button", { name: "Reiniciar datos sintéticos" }).click();
  await expect(page.getByText("Confirmar reinicio destructivo")).toBeVisible();
  await expect(page.getByText(/solo las filas del dataset sintético/)).toBeVisible();
  await page.getByRole("button", { name: "Sí, reiniciar datos sintéticos" }).click();
  await expect(page.getByText(/Reinicio completado: 12 tareas, 6 recurrencias/)).toBeVisible();

  // Weather sync: modo demostración degradado, sin secretos.
  await page.getByRole("button", { name: "Sincronizar meteorología" }).click();
  await expect(page.getByText("AEMET no configurado · datos sintéticos")).toBeVisible();
  await expect(page.getByText(/7 insertados, 0 actualizados/)).toBeVisible();
  const bodyText = (await page.textContent("body")) ?? "";
  expect(bodyText).not.toMatch(/api_key|api-key|Bearer /i);
  await expect(page.getByText("Nunca reinicia infraestructura")).toBeVisible();
});

test("weather sync con error muestra estado de error honesto", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json(adminMe);
      return;
    }
    if (url.pathname.endsWith("/admin/synthetic/scheduler")) {
      await json(schedulerActive);
      return;
    }
    if (url.pathname.endsWith("/weather/sync")) {
      await json({ ...syncGenerated, status: "error", modo: "aemet_real", error: "AEMET no devolvio dias de prediccion" });
      return;
    }
    if (url.pathname.endsWith("/weather/current")) {
      await json(weatherCurrent);
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });
  await page.route("**/health", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(health) }),
  );

  await page.goto("/integration");
  await page.getByRole("button", { name: "Sincronizar meteorología" }).click();
  await expect(page.getByText(/Sincronización con error/)).toBeVisible();
  await expect(page.getByText(/AEMET no devolvio dias/).first()).toBeVisible();
});

test("operario no ve el panel operativo (acceso denegado)", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json(operarioMe);
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });
  await page.route("**/health", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(health) }),
  );

  await page.goto("/integration");
  await expect(page.getByText("Scheduler sintético")).toHaveCount(0);
  await expect(page.getByText("Sincronizar meteorología")).toHaveCount(0);
  await expect(page.getByText("Reiniciar datos sintéticos")).toHaveCount(0);
});

test("doble clic en pausar emite una sola petición", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
  let pauseCalls = 0;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json(adminMe);
      return;
    }
    if (url.pathname.endsWith("/admin/synthetic/scheduler/pause")) {
      pauseCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await json({ ...schedulerActive, paused: true });
      return;
    }
    if (url.pathname.endsWith("/admin/synthetic/scheduler")) {
      await json(schedulerActive);
      return;
    }
    if (url.pathname.endsWith("/weather/current")) {
      await json(weatherCurrent);
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });
  await page.route("**/health", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(health) }),
  );

  await page.goto("/integration");
  const pauseBtn = page.getByRole("button", { name: "Pausar scheduler" });
  await expect(pauseBtn).toBeVisible();
  // Esperar hidratación + estado cargado: el clic en SSR sin hidratar se pierde.
  await expect(page.getByText("Creadas / omitidas")).toBeVisible();
  await pauseBtn.click();
  // El estado pendiente es explícito y síncrono al clic: el nombre cambia…
  const pausingBtn = page.getByRole("button", { name: "Pausando…" });
  await expect(pausingBtn).toBeDisabled();
  // …y aunque llegue un segundo clic, el guard single-flight lo absorbe.
  await pausingBtn.dispatchEvent("click");
  await expect(page.getByText("Scheduler sintético pausado")).toBeVisible();
  expect(pauseCalls).toBe(1);
});
