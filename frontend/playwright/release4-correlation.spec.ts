import { expect, test } from "@playwright/test";

const animals = [
  { id: "11111111-1111-4111-8111-111111111111", crotal_oficial: "SYN-00001", nombre: "Lúa", estado: "produccion", raza: "Frisona" },
  { id: "22222222-2222-4222-8222-222222222222", crotal_oficial: "SYN-00002", nombre: "Estrela", estado: "produccion", raza: "Frisona" },
];

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

const correlation = {
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

test("predicciones expone vistas granulares y asociación meteo honesta", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json({ id: "user-r4", username: "r4", email: "r4@example.invalid", activo: true, role: "admin" });
      return;
    }
    if (url.pathname.endsWith("/animals")) {
      await json(animals);
      return;
    }
    if (url.pathname.includes("/predictions/production/")) {
      await json(composite.produccion);
      return;
    }
    if (url.pathname.includes("/predictions/composition/")) {
      await json(composite.composicion);
      return;
    }
    if (url.pathname.includes("/predictions/health-risk/")) {
      await json(composite.riesgo_sanitario);
      return;
    }
    if (url.pathname.includes("/predictions/")) {
      await json(composite);
      return;
    }
    if (url.pathname.endsWith("/weather/correlation/impact")) {
      await json(correlation);
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/predictions");
  await expect(page.getByRole("heading", { name: "Predicciones" })).toBeVisible();
  await expect(page.getByText("heurísticas aritméticas")).toBeVisible();

  // Vista granular de producción con endpoint dedicado.
  await page.getByRole("tab", { name: "Producción" }).click();
  await page.getByRole("button", { name: "Cargar pagina" }).click();
  await expect(page.getByText("Produccion prevista").first()).toBeVisible();
  await expect(page.getByText(/Vista granular · endpoint dedicado/).first()).toBeVisible();

  // Vista granular de composición: placeholder honesto n/d.
  await page.getByRole("tab", { name: "Composición" }).click();
  await expect(page.getByText("Composición prevista").first()).toBeVisible();

  // Vista granular de riesgo sanitario.
  await page.getByRole("tab", { name: "Riesgo sanitario" }).click();
  await expect(page.getByText("Riesgo", { exact: true }).first()).toBeVisible();

  // Vista meteo: etiqueta honesta exacta y tabla descriptiva sin lenguaje causal.
  await page.getByRole("tab", { name: "Asociación meteo" }).click();
  await expect(
    page.getByText("Asociación descriptiva sobre datos sintéticos; no implica causalidad ni validez predictiva, clínica o productiva"),
  ).toBeVisible();
  await expect(page.getByText("Método: pearson_descriptivo")).toBeVisible();
  await expect(page.getByText("r de Pearson").first()).toBeVisible();
  await expect(page.getByText(/sin implicar causalidad/).first()).toBeVisible();
  const bodyText = (await page.textContent("body")) ?? "";
  expect(bodyText).not.toMatch(/provoca la producción|causa directa|recomendamos aplicar/i);
});

test("correlación sin soporte muestra estado vacío honesto", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json({ id: "user-r4", username: "r4", email: "r4@example.invalid", activo: true, role: "admin" });
      return;
    }
    if (url.pathname.endsWith("/animals")) {
      await json(animals);
      return;
    }
    if (url.pathname.includes("/predictions/")) {
      await json(composite);
      return;
    }
    if (url.pathname.endsWith("/weather/correlation/impact")) {
      await json({ ...correlation, status: "insufficient_data", sample_size: 2, asociaciones: [] });
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/predictions");
  await page.getByRole("tab", { name: "Asociación meteo" }).click();
  await expect(page.getByText("Sin datos suficientes")).toBeVisible();
  await expect(page.getByText(/No se describen asociaciones sin soporte/)).toBeVisible();
});

test("operario sin permiso ve mensaje de permiso en predicciones", async ({ context, page }) => {
  await context.addCookies([{ name: "t4m_token", value: "synthetic-e2e", domain: "127.0.0.1", path: "/" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/me")) {
      await json({ id: "user-op", username: "op", email: "op@example.invalid", activo: true, role: "operario" });
      return;
    }
    if (url.pathname.endsWith("/animals")) {
      await json(animals);
      return;
    }
    if (url.pathname.includes("/predictions/")) {
      await json({ detail: "No tienes permisos para realizar esta accion" }, 403);
      return;
    }
    if (url.pathname.endsWith("/weather/correlation/impact")) {
      await json(correlation);
      return;
    }
    await json({ detail: "mock no definido" }, 404);
  });

  await page.goto("/predictions");
  await page.getByRole("button", { name: "Cargar pagina" }).click();
  await expect(page.getByText(/Sin permiso para ver predicciones/).first()).toBeVisible();
});
