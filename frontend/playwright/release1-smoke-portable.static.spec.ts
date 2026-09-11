import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test, type TestInfo } from "@playwright/test";

// Gate estatico R5-RF-09: demuestra que el sustituto portable no contiene los
// literales prohibidos del legacy, declara el contrato de entorno, usa
// accesibilidad local y conserva el spec legacy. Se ejecuta sin entorno demo.
// Las rutas se resuelven desde el fichero del propio test para no depender del
// directorio de trabajo.

// Literales del legacy que el sustituto tiene prohibidos (este fichero de gate
// es el unico lugar donde pueden nombrarse, como valores a detectar).
const FORBIDDEN_LITERALS = [
  "host.docker.internal",
  "testpass123",
  "cdnjs",
  "/tmp/",
];

const REQUIRED_ENV_VARS = [
  "PLAYWRIGHT_BASE_URL",
  "DEMO_ADMIN_USER",
  "DEMO_PASSWORD",
  "E2E_WORKFLOW_PATH",
  "E2E_TV_PATH",
];

function specPaths(testFile: string) {
  const here = dirname(testFile);
  return {
    portable: join(here, "release1-smoke-portable.spec.ts"),
    legacy: join(here, "..", "..", "e2e", "release1-smoke.mjs"),
  };
}

test.describe("R5-RF-09 gate estatico del smoke portable", () => {
  test("el sustituto portable no contiene literales prohibidos", async ({}, testInfo: TestInfo) => {
    const source = readFileSync(specPaths(testInfo.file).portable, "utf8");
    for (const literal of FORBIDDEN_LITERALS) {
      expect(source, `literal prohibido presente: ${literal}`).not.toContain(
        literal
      );
    }
  });

  test("el sustituto declara el contrato de entorno y usa AxeBuilder local", async ({}, testInfo: TestInfo) => {
    const source = readFileSync(specPaths(testInfo.file).portable, "utf8");
    for (const name of REQUIRED_ENV_VARS) {
      expect(source, `variable no referenciada: ${name}`).toContain(name);
    }
    expect(source).toContain("AxeBuilder");
    expect(source).not.toContain("addScriptTag");
  });

  test("el sustituto no registra secretos y el legacy sigue versionado", async ({}, testInfo: TestInfo) => {
    const paths = specPaths(testInfo.file);
    const source = readFileSync(paths.portable, "utf8");
    expect(source).not.toContain("console.log");
    expect(existsSync(paths.portable)).toBe(true);
    expect(existsSync(paths.legacy)).toBe(true);
  });

  test("el sustituto corre en serie, sin locators genericos y con contrato de mutacion", async ({}, testInfo: TestInfo) => {
    const source = readFileSync(specPaths(testInfo.file).portable, "utf8");
    // Misma identidad demo en todas las pruebas: ejecucion serial explicita.
    expect(source).toContain('mode: "serial"');
    // Sin selectores globales ambiguos del legacy.
    expect(source).not.toContain(".nth(");
    // PUT /api/v1/tasks/{id} exige idempotencia y version optimista.
    expect(source).toContain("X-Operation-Id");
    expect(source).toContain("expected_version");
    // El login respeta la cuota del backend (5 intentos/IP/60s): espaciado
    // entre intentos y reintento unico ante el aviso de limite.
    expect(source).toContain("Demasiados intentos");
  });
});
