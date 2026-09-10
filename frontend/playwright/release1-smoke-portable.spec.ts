import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// R5-RF-09: sustituto portable y seguro del smoke legacy de Release 1.
//
// Contrato de entorno (lectura fail-fast dentro de cada prueba, nunca en la
// carga del modulo: `--list` y el analisis estatico funcionan sin demo):
//   PLAYWRIGHT_BASE_URL: origen demo esperado (la navegacion usa la raiz del
//     baseURL de la configuracion; nunca hay un origen literal aqui).
//   DEMO_ADMIN_USER: usuario demo inyectado (sin literal de credencial).
//   DEMO_PASSWORD: contrasena demo inyectada (nunca se registra).
//   E2E_WORKFLOW_PATH: ruta absoluta de la superficie de turnos y tareas.
//   E2E_TV_PATH: ruta absoluta de la superficie de solo lectura.
//
// Capturas sin rutas fijas: se usan las facilities de Playwright (traza, video
// y captura solo ante fallo) mas anexos JSON del informe; por eso no se exige
// directorio de artefactos. Accesibilidad sin red externa: AxeBuilder local.
// Este fichero no escribe en consola: ni credenciales, ni cookies, ni tokens,
// ni cabeceras.

type SmokeEnv = {
  baseUrl: string;
  adminUser: string;
  adminPassword: string;
  workflowPath: string;
  tvPath: string;
};

function requireEnv(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. ` +
        "Inyectala antes de ejecutar el smoke portable."
    );
  }
  return value;
}

function requirePathEnv(name: string): string {
  const value = requireEnv(name);
  if (!value.startsWith("/")) {
    throw new Error(
      `La variable de entorno ${name} debe ser una ruta absoluta de la app.`
    );
  }
  return value;
}

function readSmokeEnv(): SmokeEnv {
  return {
    baseUrl: requireEnv("PLAYWRIGHT_BASE_URL"),
    adminUser: requireEnv("DEMO_ADMIN_USER"),
    adminPassword: requireEnv("DEMO_PASSWORD"),
    workflowPath: requirePathEnv("E2E_WORKFLOW_PATH"),
    tvPath: requirePathEnv("E2E_TV_PATH"),
  };
}

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

async function expectNoSeriousOrCritical(page: Page): Promise<void> {
  const results = await new AxeBuilder({
    page: page as unknown as AxePage,
  }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function loginAsAdmin(
  page: Page,
  user: string,
  password: string
): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("input").nth(0).fill(user);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page
    .getByRole("button", { name: "Actualizar datos del dashboard" })
    .first()
    .waitFor({ timeout: 60000 });
  await page.waitForLoadState("networkidle");
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "tv", width: 1920, height: 1080 },
] as const;

const SCHEDULER_SCENARIOS = [
  { name: "normal", scenario: "normal" },
  { name: "delays", scenario: "delayed_tasks" },
  { name: "incident", scenario: "critical_machinery" },
  { name: "unassigned", scenario: "incomplete_data" },
  { name: "incomplete", scenario: "incomplete_data" },
  { name: "service_failure", scenario: "aemet_failure" },
] as const;

test.describe("Release 1 smoke portable (R5-RF-09)", () => {
  for (const viewport of VIEWPORTS) {
    test(`viewport ${viewport.name}: login, marcador sintetico y axe`, async ({
      page,
    }, testInfo) => {
      const env = readSmokeEnv();
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await loginAsAdmin(page, env.adminUser, env.adminPassword);
      await expect(
        page.getByText("Datos de demo sintética", { exact: false }).first()
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Actualizar datos del dashboard" })
        .click();
      await expect(
        page.getByText(/Última actualización|Sin actualización todavía/).first()
      ).toBeVisible();
      await expectNoSeriousOrCritical(page);
      await testInfo.attach(`resumen-${viewport.name}`, {
        body: JSON.stringify({ viewport: viewport.name, syntheticMarker: true }),
        contentType: "application/json",
      });
    });
  }

  test("workflow: filtros de turno, detalle kanban y marcador sintetico", async ({
    page,
  }) => {
    const env = readSmokeEnv();
    await loginAsAdmin(page, env.adminUser, env.adminPassword);
    await page.goto(env.workflowPath, { waitUntil: "networkidle" });
    await page.locator("#shift-filter").selectOption("manana");
    expect(await page.locator("#shift-filter").inputValue()).toBe("manana");
    await page.locator("#shift-filter").selectOption("tarde");
    expect(await page.locator("#shift-filter").inputValue()).toBe("tarde");
    const detail = page.getByRole("button", { name: /Ver detalle de/ }).first();
    if ((await detail.count()) > 0) {
      await detail.click();
      await expect(
        page.getByRole("heading", { name: "Asignar tarea" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancelar" }).click();
    } else {
      test.skip(
        true,
        "Sin tarjetas de tarea en el entorno demo; se omite el detalle kanban."
      );
      return;
    }
    await expect(
      page.getByText("Datos de demo sintética", { exact: false }).first()
    ).toBeVisible();
    await expectNoSeriousOrCritical(page);
  });

  test("transiciones de tarea: valida aceptada e invalida rechazada", async ({
    page,
  }) => {
    const env = readSmokeEnv();
    await loginAsAdmin(page, env.adminUser, env.adminPassword);
    await page.goto(env.workflowPath, { waitUntil: "domcontentloaded" });

    type TransitionOutcome = {
      found: boolean;
      validStatus: number;
      invalidStatus: number;
    };

    const outcome = await page.evaluate(async (): Promise<TransitionOutcome> => {
      const empty: TransitionOutcome = {
        found: false,
        validStatus: 0,
        invalidStatus: 0,
      };
      const listResponse = await fetch("/api/v1/tasks?limit=20", {
        credentials: "include",
      });
      if (!listResponse.ok) return empty;
      const payload: unknown = await listResponse.json();
      if (!Array.isArray(payload)) return empty;
      const target = payload.find(
        (item: unknown): item is { id: string; estado: string } => {
          if (typeof item !== "object" || item === null) return false;
          const record = item as Record<string, unknown>;
          return (
            typeof record["id"] === "string" &&
            (record["estado"] === "programada" || record["estado"] === "retrasada")
          );
        }
      );
      if (!target) return empty;
      const valid = await fetch(`/api/v1/tasks/${target.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estado: "ejecutada" }),
      });
      const invalid = await fetch(`/api/v1/tasks/${target.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estado: "estado_invalido" }),
      });
      return {
        found: true,
        validStatus: valid.status,
        invalidStatus: invalid.status,
      };
    });

    if (!outcome.found) {
      test.skip(
        true,
        "Sin tareas en estado programada/retrasada; transiciones no ejercitadas."
      );
      return;
    }
    expect(outcome.validStatus).toBeGreaterThanOrEqual(200);
    expect(outcome.validStatus).toBeLessThan(300);
    expect([400, 422]).toContain(outcome.invalidStatus);
  });

  test("scheduler: escenarios sinteticos aceptados", async ({ page }) => {
    const env = readSmokeEnv();
    await loginAsAdmin(page, env.adminUser, env.adminPassword);
    await page.goto(env.workflowPath, { waitUntil: "domcontentloaded" });
    for (const entry of SCHEDULER_SCENARIOS) {
      const outcome = await page.evaluate(
        async (scenario: string): Promise<{ ok: boolean; status: number }> => {
          const response = await fetch(
            `/api/v1/admin/synthetic/scheduler/run?profile=small&scenario=${scenario}&horizon_days=1`,
            { method: "POST", credentials: "include" }
          );
          return { ok: response.ok, status: response.status };
        },
        entry.scenario
      );
      expect(outcome.ok, `escenario ${entry.name}: estado ${outcome.status}`).toBe(
        true
      );
    }
  });

  test("superficie de lectura: sin mutaciones de red y axe limpio", async ({
    page,
  }) => {
    const env = readSmokeEnv();
    await loginAsAdmin(page, env.adminUser, env.adminPassword);
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
        mutations.push(request.method());
      }
    });
    await page.goto(env.tvPath, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    expect(mutations).toEqual([]);
    await expectNoSeriousOrCritical(page);
  });
});
