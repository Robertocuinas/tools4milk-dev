import { expect, test } from "@playwright/test";

const animals = [
  { id: "11111111-1111-4111-8111-111111111111", crotal_oficial: "SYN-00001", nombre: "Lúa", estado: "produccion", raza: "Frisona" },
  { id: "22222222-2222-4222-8222-222222222222", crotal_oficial: "SYN-00002", nombre: "Estrela", estado: "produccion", raza: "Frisona" },
];

const lactations = animals.map((animal, index) => ({
  id: `33333333-3333-4333-8333-33333333333${index}`,
  animal_id: animal.id,
  numero_lactacion: 1,
  fecha_inicio: "2026-05-01",
  dias_transcurridos: 120,
  produccion_promedio: 29 + index,
  produccion_total: 3480,
  grasa_promedio: 3.9,
  proteina_promedio: 3.3,
  rcs_promedio: 145000,
}));

test("calidad muestra una serie por animal y no inventa puntos al quedar vacía", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", url: "http://127.0.0.1:3000" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json({ id: "user-r4", username: "r4", email: "r4@example.invalid", activo: true, role: "admin" });
      return;
    }
    if (url.pathname.endsWith("/animals")) {
      await json(animals);
      return;
    }
    if (url.pathname.endsWith("/lactations")) {
      await json(lactations);
      return;
    }
    if (url.pathname.endsWith("/lactations/quality/summary")) {
      await json({ lactaciones_activas: 2, produccion_promedio: 29.5, grasa_promedio: 3.9, proteina_promedio: 3.3, rcs_promedio: 145000, animales_en_control: 2 });
      return;
    }
    if (url.pathname.includes(`/animals/${animals[0].id}/readings`)) {
      await json({
        animal_id: animals[0].id,
        provenance: { source: "generated", mode: "synthetic", synthetic: true },
        count: 3,
        days: 30,
        limit: 90,
        readings: [
          { ts: "2026-05-28T06:00:00Z", fecha: "2026-05-28", produccion_kg: 28.2, scc: 140000, conductividad: 5.2, flujo_max: 3.1, duracion_min: 7 },
          { ts: "2026-05-29T06:00:00Z", fecha: "2026-05-29", produccion_kg: 29.1, scc: 145000, conductividad: 5.3, flujo_max: 3.2, duracion_min: 7 },
          { ts: "2026-05-30T06:00:00Z", fecha: "2026-05-30", produccion_kg: 29.8, scc: 142000, conductividad: 5.1, flujo_max: 3.3, duracion_min: 7 },
        ],
      });
      return;
    }
    if (url.pathname.includes(`/animals/${animals[1].id}/readings`)) {
      await json({ animal_id: animals[1].id, provenance: { source: "generated", mode: "synthetic", synthetic: true }, count: 0, days: 30, limit: 90, readings: [] });
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/quality");
  await expect(page.getByRole("heading", { name: "Calidad de leche" })).toBeVisible();
  await expect(page.getByText("Datos de demo sintética")).toBeVisible();
  await expect(page.getByText("3 lecturas · orden cronológico")).toBeVisible();
  await expect(page.getByRole("img", { name: "Grafico de tendencia" })).toBeVisible();

  await page.getByLabel("Métrica de la tendencia").selectOption("scc");
  await expect(page.getByRole("region", { name: "Células somáticas en cél/mL" })).toBeVisible();

  await page.getByLabel("Animal para la tendencia").selectOption(animals[1].id);
  await expect(page.getByText("Sin datos suficientes")).toBeVisible();
  await expect(page.getByText("no se inventan puntos")).toBeVisible();
});
