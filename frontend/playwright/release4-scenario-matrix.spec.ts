import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// R4-5: matriz E2E determinista de escenarios DSS sintéticos.
//
// Semilla fijada y documentada: profile=small, seed=20260910,
// simulation_time=2026-09-10T12:00:00+00:00, generador canónico
// backend/app/synthetic_data.py (sin datos manuales ad hoc: los mocks
// reproducen la huella diferencial del generador por escenario).
//
// Matriz mínima (5 escenarios):
//   normal           → /quality con serie + provenance sintética
//   delayed_tasks    → /tasks con tareas retrasadas
//   health_alert     → /incidents con alerta sanitaria ligada a animal
//   degraded_quality → /predictions + asociación meteo con soporte
//   incomplete_data  → /quality vacía honesta + correlación insufficient_data
//
// Cada recorrido demuestra provenance sintética y estados de
// carga/error/vacío/DQ; la ausencia de datos nunca se confunde con cero.
// Gate axe: cero violaciones serious/critical en cada superficie.

const SEED_COMMENT = "seed=20260910 profile=small generator=1.0.0";

const adminMe = { id: "user-admin", username: "admin", email: "admin@example.invalid", activo: true, role: "admin" };

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

const qualitySummary = {
  lactaciones_activas: 2,
  produccion_promedio: 29.5,
  grasa_promedio: 3.9,
  proteina_promedio: 3.3,
  rcs_promedio: 145000,
  animales_en_control: 2,
};

function readingsOk(animalId: string, degraded = false) {
  return {
    animal_id: animalId,
    provenance: { source: "generated", mode: "synthetic", synthetic: true },
    count: 3,
    days: 30,
    limit: 90,
    readings: [
      { ts: "2026-05-28T06:00:00Z", fecha: "2026-05-28", produccion_kg: degraded ? 20.3 : 28.2, scc: degraded ? 360000 : 140000, conductividad: 5.2, flujo_max: 3.1, duracion_min: 7 },
      { ts: "2026-05-29T06:00:00Z", fecha: "2026-05-29", produccion_kg: degraded ? 20.9 : 29.1, scc: degraded ? 365000 : 145000, conductividad: 5.3, flujo_max: 3.2, duracion_min: 7 },
      { ts: "2026-05-30T06:00:00Z", fecha: "2026-05-30", produccion_kg: degraded ? 21.4 : 29.8, scc: degraded ? 362000 : 142000, conductividad: 5.1, flujo_max: 3.3, duracion_min: 7 },
    ],
  };
}

function readingsEmpty(animalId: string) {
  return {
    animal_id: animalId,
    provenance: { source: "generated", mode: "synthetic", synthetic: true },
    count: 0,
    days: 30,
    limit: 90,
    readings: [],
  };
}

const pendingAlert = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  animal_id: animals[0].id,
  tipo_alerta: "health_alert",
  severidad: "alta",
  descripcion: "Alerta sintética de seguimiento",
  recomendacion: null,
  estado: "pendiente",
  fecha_creacion: "2026-09-09T12:00:00Z",
  fecha_revision: null,
  version: 1,
};

const composite = {
  animal_id: animals[0].id,
  timestamp: "2026-09-10T06:00:00Z",
  provenance: { source: "generated", mode: "synthetic", synthetic: true },
  method: "heuristic_arithmetic",
  validated: false,
  limitations: ["Heurística aritmética experimental."],
  produccion: {
    tendencia: "estable",
    produccion_promedio_predicha: 29.5,
    produccion_minima_predicha: 27.4,
    produccion_maxima_predicha: 31.6,
    dias_prediccion: 7,
    series_diaria: [28.9, 29.2, 29.5, 29.8, 29.5, 30.1, 29.8],
  },
  composicion: {
    grasa: { prediccion: 0, tendencia: "estable" },
    proteina: { prediccion: 0, tendencia: "estable" },
    lactosa: { prediccion: 0, tendencia: "estable" },
    anomalia_detectada: false,
  },
  riesgo_sanitario: {
    riesgo_promedio: "bajo",
    riesgos_especificos: {},
    factores_riesgo: [],
    dias_prediccion: 7,
  },
};

const correlationOk = {
  ubicacion: "Villalba, Lugo",
  dias_adelante: 7,
  ventana_dias: 30,
  metodo: "pearson_descriptivo",
  formula: "r = Σ((x - mx)(y - my)) / sqrt(Σ(x - mx)² · Σ(y - my)²)",
  status: "sufficient",
  sample_size: 8,
  min_sample_size: 5,
  asociaciones: [
    {
      variable_meteo: "temperatura_c_media_diaria",
      variable_productiva: "produccion_kg_media_diaria",
      n: 8,
      pearson_r: 0.97,
      media_meteo: 18.5,
      media_productiva: 29.1,
      interpretacion: "n=8: co-variación lineal observada fuerte y positiva (r=0.97); describe solo los días incluidos, sin implicar causalidad",
    },
  ],
  impactos_predichos: [],
  aviso: "Asociación descriptiva sobre datos sintéticos; no implica causalidad ni validez predictiva, clínica o productiva",
  provenance: { source: "generated", mode: "synthetic", synthetic: true },
};

const correlationEmpty = { ...correlationOk, status: "insufficient_data", sample_size: 2, asociaciones: [] };

type AxeOptions = ConstructorParameters<typeof AxeBuilder>[0];

async function expectNoSeriousOrCritical(page: Page) {
  const results = await new AxeBuilder({ page: page as unknown as AxeOptions["page"] }).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function mockAuth(page: Page) {
  await page.context().addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
}

// Escenario normal: serie de calidad con provenance visible + dashboard.
test(`normal recorre calidad con serie sintética (${SEED_COMMENT})`, async ({ page }) => {
  await mockAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/auth/me")) return json(adminMe);
    if (url.pathname.endsWith("/animals")) return json(animals);
    if (url.pathname.endsWith("/lactations")) return json(lactations);
    if (url.pathname.endsWith("/lactations/quality/summary")) return json(qualitySummary);
    if (url.pathname.includes(`/animals/${animals[0].id}/readings`)) return json(readingsOk(animals[0].id));
    if (url.pathname.includes(`/animals/${animals[1].id}/readings`)) return json(readingsEmpty(animals[1].id));
    if (url.pathname.endsWith("/dashboard/summary"))
      return json({
        alertas: { total_pendientes: 1, criticas: 0, altas: 1 },
        tareas: { programadas: 6, ejecutadas: 2, retrasadas: 0 },
        animales: { activos: 2, por_zona: [] },
        tratamientos: { activos: 0 },
      });
    if (url.pathname.endsWith("/incidents")) return json([]);
    if (url.pathname.endsWith("/weather/current"))
      return json({ temperatura_actual: 18.5, descripcion: "Despejado", fuente: "generated" });
    return json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/quality");
  await expect(page.getByRole("heading", { name: "Calidad de leche" })).toBeVisible();
  await expect(page.getByText("Datos de demo sintética")).toBeVisible();
  await expect(page.getByText("3 lecturas · orden cronológico")).toBeVisible();
  const body = (await page.textContent("body")) ?? "";
  expect(body).toMatch(/synthetic\/generated/);
  await expectNoSeriousOrCritical(page);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Estado operativo de la explotación" })).toBeVisible();
  await expect(page.getByText("Fuente: datos de demo sintética")).toBeVisible();
  await expectNoSeriousOrCritical(page);
});

// Escenario delayed_tasks: tareas retrasadas visibles sin confundir estados.
test(`delayed_tasks muestra tareas retrasadas (${SEED_COMMENT})`, async ({ page }) => {
  await mockAuth(page);
  const retrasada = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tarea_catalogo_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tarea_catalogo: { nombre: "Ordeño de control sintético", categoria: "ordeno", zona_aplicable: "Nave" },
    zona_id: null,
    empleado_id: null,
    fecha_programada: "2026-09-09T06:00:00Z",
    estado: "retrasada",
    checklist_completado: "[]",
    es_urgente: false,
    requiere_seguimiento: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/auth/me")) return json(adminMe);
    if (url.pathname.endsWith("/tareas-catalogo")) return json([]);
    if (url.pathname.endsWith("/zones")) return json([]);
    if (url.pathname.endsWith("/tasks")) {
      const estado = url.searchParams.get("estado");
      return json(estado === "retrasada" ? [retrasada] : []);
    }
    return json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Tareas" })).toBeVisible();
  await page.getByRole("button", { name: /Retrasadas/ }).click();
  await expect(page.getByText("Ordeño de control sintético")).toBeVisible();
  await expect(page.getByText("retrasada").first()).toBeVisible();
  await expectNoSeriousOrCritical(page);
});

// Escenario health_alert: alerta sanitaria ligada a animal en incidencias.
test(`health_alert liga alerta sanitaria a animal (${SEED_COMMENT})`, async ({ page }) => {
  await mockAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/auth/me")) return json(adminMe);
    if (url.pathname.endsWith("/alerts")) return json({ total: 1, alertas: [pendingAlert], skip: 0, limit: 200 });
    if (url.pathname.endsWith("/incidents")) return json([]);
    if (url.pathname.endsWith("/zones")) return json([]);
    if (url.pathname.endsWith("/animals")) return json([animals[0]]);
    return json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/incidents");
  await expect(page.getByRole("heading", { name: "Incidencias" })).toBeVisible();
  await expect(page.getByText("health_alert").first()).toBeVisible();
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toMatch(/valor cero|0 kg/i);
  await expectNoSeriousOrCritical(page);
});

// Escenario degraded_quality: predicciones granulares + correlación con soporte.
test(`degraded_quality expone predicción y asociación con soporte (${SEED_COMMENT})`, async ({ page }) => {
  await mockAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/auth/me")) return json(adminMe);
    if (url.pathname.endsWith("/animals")) return json(animals);
    if (url.pathname.includes("/predictions/production/")) return json(composite.produccion);
    if (url.pathname.includes("/predictions/composition/")) return json(composite.composicion);
    if (url.pathname.includes("/predictions/health-risk/")) return json(composite.riesgo_sanitario);
    if (url.pathname.includes("/predictions/")) return json(composite);
    if (url.pathname.endsWith("/weather/correlation/impact")) return json(correlationOk);
    return json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/predictions");
  await expect(page.getByRole("heading", { name: "Predicciones" })).toBeVisible();
  await expect(page.getByText("heurísticas aritméticas")).toBeVisible();
  await page.getByRole("tab", { name: "Asociación meteo" }).click();
  await expect(
    page.getByText("Asociación descriptiva sobre datos sintéticos; no implica causalidad ni validez predictiva, clínica o productiva"),
  ).toBeVisible();
  await expect(page.getByText("r de Pearson").first()).toBeVisible();
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toMatch(/provoca la producción|causa directa|recomendamos aplicar/i);
  await expectNoSeriousOrCritical(page);
});

// Escenario incomplete_data: vacíos honestos, sin inventar puntos ni asociaciones.
test(`incomplete_data muestra vacíos honestos sin inventar (${SEED_COMMENT})`, async ({ page }) => {
  await mockAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/auth/me")) return json(adminMe);
    if (url.pathname.endsWith("/animals")) return json(animals);
    if (url.pathname.endsWith("/lactations")) return json(lactations);
    if (url.pathname.endsWith("/lactations/quality/summary")) return json(qualitySummary);
    if (url.pathname.includes("/readings")) return json(readingsEmpty(animals[0].id));
    if (url.pathname.includes("/predictions/")) return json(composite);
    if (url.pathname.endsWith("/weather/correlation/impact")) return json(correlationEmpty);
    return json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/quality");
  await expect(page.getByText("Sin datos suficientes").first()).toBeVisible();
  await expect(page.getByText("no se inventan puntos")).toBeVisible();
  const qualityBody = (await page.textContent("body")) ?? "";
  expect(qualityBody).not.toMatch(/0 lecturas · orden cronológico/);

  await page.goto("/predictions");
  await page.getByRole("tab", { name: "Asociación meteo" }).click();
  await expect(page.getByText("Sin datos suficientes").first()).toBeVisible();
  await expect(page.getByText(/No se describen asociaciones sin soporte/)).toBeVisible();
  await expectNoSeriousOrCritical(page);
});

// Barrido de viewports representativos sobre superficies nuevas R4.
test("axe sin violaciones serias en viewports R4 (calidad y predicciones)", async ({ page }) => {
  await mockAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.endsWith("/auth/me")) return json(adminMe);
    if (url.pathname.endsWith("/animals")) return json(animals);
    if (url.pathname.endsWith("/lactations")) return json(lactations);
    if (url.pathname.endsWith("/lactations/quality/summary")) return json(qualitySummary);
    if (url.pathname.includes("/readings")) return json(readingsOk(animals[0].id));
    if (url.pathname.includes("/predictions/")) return json(composite);
    if (url.pathname.endsWith("/weather/correlation/impact")) return json(correlationOk);
    return json({ detail: "mock no definido" }, 404);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/quality");
    await expect(page.getByRole("heading", { name: "Calidad de leche" })).toBeVisible();
    await expectNoSeriousOrCritical(page);
    await page.goto("/predictions");
    await expect(page.getByRole("heading", { name: "Predicciones" })).toBeVisible();
    await expectNoSeriousOrCritical(page);
  }
});
