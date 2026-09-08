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
try {
  for (const [width, height, name] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.locator("input").nth(0).fill("admin");
    await page.locator('input[type="password"]').fill("testpass123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/dashboard/);
    await page.waitForLoadState("networkidle");
    await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.11.0/axe.min.js" });
    const axe = await page.evaluate(async () => axe.run());
    await page.screenshot({ path: `/tmp/release1-${name}.png`, fullPage: true });
    results.push({ viewport: name, url: page.url(), axeViolations: axe.violations.length });
    if (axe.violations.length) throw new Error(`${name}: axe violations`);
    await page.close();
  }
  console.log(JSON.stringify({ status: "ok", viewports: results }, null, 2));
} finally {
  await browser.close();
}
