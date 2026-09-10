import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Alert } from "@/lib/types";

const pendingAlert: Alert = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  animal_id: "11111111-1111-4111-8111-111111111111",
  tipo_alerta: "health_alert",
  severidad: "alta",
  descripcion: "Alerta sintética de seguimiento",
  recomendacion: null,
  estado: "pendiente",
  fecha_creacion: "2026-09-09T12:00:00Z",
  fecha_revision: null,
  version: 1,
};

const appHost = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").hostname;

async function mockAlerts(page: Page, role: "admin" | "operario") {
  await page.context().addCookies([
    { name: "t4m_token", value: `synthetic-${role}`, domain: appHost, path: "/" },
  ]);
  let currentAlert: Alert = { ...pendingAlert };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      return json({
        id: `user-${role}`,
        username: role,
        email: `${role}@example.invalid`,
        activo: true,
        role,
      });
    }
    if (url.pathname.endsWith("/alerts") && request.method() === "GET") {
      return json({ total: 1, alertas: [currentAlert], skip: 0, limit: 200 });
    }
    if (url.pathname.endsWith(`/alerts/${pendingAlert.id}`) && request.method() === "PATCH") {
      expect(request.headers()["x-operation-id"]).toMatch(/^[0-9a-f-]{36}$/);
      expect(request.postDataJSON()).toEqual({ estado: "resuelta", expected_version: 1 });
      currentAlert = {
        ...currentAlert,
        estado: "resuelta",
        fecha_revision: "2026-09-09T12:05:00Z",
        version: 2,
      };
      return json({
        operation_id: request.headers()["x-operation-id"],
        replayed: false,
        alert: currentAlert,
      });
    }
    if (url.pathname.endsWith("/incidents") || url.pathname.endsWith("/zones")) {
      return json([]);
    }
    if (url.pathname.endsWith("/animals")) {
      return json([
        {
          id: pendingAlert.animal_id,
          crotal_oficial: "SYN-00001",
          nombre: "Lúa",
          estado: "produccion",
        },
      ]);
    }
    return json({ detail: "mock no definido" }, 404);
  });
}

test("usuario autorizado confirma y resuelve una alerta sintética", async ({ page }) => {
  await mockAlerts(page, "admin");
  await page.goto("/alerts");

  await expect(page.getByRole("heading", { name: "Alertas" })).toBeVisible();
  await page.getByRole("button", { name: "Resolver alerta" }).click();
  await expect(page.getByRole("dialog", { name: "Confirmar resolución" })).toBeVisible();
  await page.getByRole("button", { name: "Sí, resolver" }).click();

  await expect(page.getByText("Alerta resuelta").first()).toBeVisible();
  await expect(
    page.getByLabel("Alerta health_alert").getByText("Resuelta", { exact: true }),
  ).toBeVisible();
  type AxeOptions = ConstructorParameters<typeof AxeBuilder>[0];
  const results = await new AxeBuilder({ page: page as unknown as AxeOptions["page"] }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("usuario sin capability no ve el control de resolución", async ({ page }) => {
  await mockAlerts(page, "operario");
  await page.goto("/alerts");

  await expect(page.getByRole("heading", { name: "Alertas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resolver alerta" })).toHaveCount(0);
});

test("TV permanece en solo lectura", async ({ page }) => {
  await mockAlerts(page, "admin");
  await page.goto("/tv");

  await expect(page.getByRole("button", { name: "Resolver alerta" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sí, resolver" })).toHaveCount(0);
});
