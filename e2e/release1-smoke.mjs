import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://host.docker.internal:18080";
const viewports = [
  [390, 844, "mobile"],
  [768, 1024, "tablet"],
  [1440, 900, "desktop"],
  [1920, 1080, "tv"],
];
const browser = await chromium.launch({ headless: true });
const results = [];
const checks = [];
let workflowPage;

async function login(page) {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.locator("input").nth(0).fill("admin");
  await page.locator('input[type="password"]').fill("testpass123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.waitForLoadState("networkidle");
}

try {
  for (const [width, height, name] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    await login(page);
    await page.getByText("Datos de demo sintética", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: "Actualizar datos del dashboard" }).click();
    await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.11.0/axe.min.js" });
    const axe = await page.evaluate(async () => axe.run());
    await page.screenshot({ path: `/tmp/release1-${name}.png`, fullPage: true });
    results.push({
      viewport: name,
      url: page.url(),
      syntheticMarker: await page.getByText("Datos de demo sintética", { exact: false }).count() > 0,
      timestamp: await page.getByText(/Última actualización|Sin actualización todavía/).count() > 0,
      axeViolations: axe.violations.length,
      axeRuleIds: axe.violations.map((violation) => violation.id),
      axeDetails: axe.violations.flatMap((violation) => violation.nodes.map((node) => ({ id: violation.id, html: node.html, target: node.target }))),
    });
    if (name === "mobile") workflowPage = page;
    else await page.close();
  }

  const page = workflowPage;
  if (!page) throw new Error("Workflow page was not created");
  await page.goto(`${baseURL}/leanfarming`, { waitUntil: "networkidle" });
  await page.locator("#shift-filter").selectOption("manana");
  checks.push({ name: "shift_morning_filter", passed: await page.locator("#shift-filter").inputValue() === "manana" });
  await page.locator("#shift-filter").selectOption("tarde");
  checks.push({ name: "shift_afternoon_filter", passed: await page.locator("#shift-filter").inputValue() === "tarde" });
  const detail = page.getByRole("button", { name: /Ver detalle de/ }).first();
  if (await detail.count()) {
    await detail.click();
    checks.push({ name: "kanban_detail", passed: await page.getByRole("heading", { name: "Asignar tarea" }).isVisible() });
    await page.getByRole("button", { name: "Cancelar" }).click();
  } else {
    checks.push({ name: "kanban_detail", passed: false, reason: "No task card rendered" });
  }
  checks.push({ name: "leanfarming_synthetic_marker", passed: await page.getByText("Datos de demo sintética", { exact: false }).count() > 0 });

  const apiResult = await page.evaluate(async () => {
    const tasksResponse = await fetch("/api/v1/tasks?limit=20", { credentials: "include" });
    const tasks = await tasksResponse.json();
    const task = Array.isArray(tasks) ? tasks.find((item) => item.estado === "programada" || item.estado === "retrasada") : null;
    if (!task) return { task: false };
    const valid = await fetch(`/api/v1/tasks/${task.id}`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ estado: "ejecutada" }),
    });
    const invalid = await fetch(`/api/v1/tasks/${task.id}`, {
      method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ estado: "estado_invalido" }),
    });
    return { task: true, validStatus: valid.status, invalidStatus: invalid.status };
  });
  checks.push({ name: "valid_transition_persisted", passed: apiResult.validStatus >= 200 && apiResult.validStatus < 300 });
  checks.push({ name: "invalid_transition_rejected", passed: apiResult.invalidStatus === 400 || apiResult.invalidStatus === 422 });

  const scenarios = [
    ["normal", "normal"],
    ["delays", "delayed_tasks"],
    ["incident", "critical_machinery"],
    ["unassigned", "incomplete_data"],
    ["incomplete", "incomplete_data"],
    ["service_failure", "aemet_failure"],
  ];
  for (const [name, scenario] of scenarios) {
    const response = await page.request.post(`${baseURL}/api/v1/admin/synthetic/scheduler/run?profile=small&scenario=${scenario}&horizon_days=1`);
    checks.push({ name: `scenario_${name}`, passed: response.ok(), status: response.status() });
  }
  await page.goto(`${baseURL}/tv`, { waitUntil: "networkidle" });
  const mutations = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) mutations.push(request.method());
  });
  await page.waitForTimeout(500);
  checks.push({ name: "tv_read_only", passed: mutations.length === 0, mutations });
  await page.screenshot({ path: "/tmp/release1-tv.png", fullPage: true });
  await page.close();

  console.log(JSON.stringify({ status: "ok", viewports: results, checks }, null, 2));
} finally {
  await browser.close();
}
