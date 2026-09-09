import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "tv", width: 1920, height: 1080 },
];

test.describe("Release 2 synthetic browser contract", () => {
  for (const viewport of viewports) {
    test(`axe has no violations at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      type AxeOptions = ConstructorParameters<typeof AxeBuilder>[0];
      const results = await new AxeBuilder({ page: page as unknown as AxeOptions["page"] }).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test("session identity is not persisted in web storage", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const storage = await page.evaluate(async () => {
      const local = Object.entries(localStorage);
      const session = Object.entries(sessionStorage);
      const databases = "databases" in indexedDB ? await indexedDB.databases() : [];
      const cacheNames = "caches" in window ? await caches.keys() : [];
      return { local, session, databases, cacheNames };
    });
    const serialized = JSON.stringify(storage).toLowerCase();
    expect(serialized).not.toMatch(/t4m_user|t4m_token|email|password|access_token|refresh_token/);
  });
});
