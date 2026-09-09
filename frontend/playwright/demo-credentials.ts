/**
 * Demo login credentials for Playwright specs.
 *
 * Login specs MUST NOT hardcode a password: Release 3 generates a random
 * INITIAL_DEMO_PASSWORD per `init`, so any fixed value couples the tests to
 * stale test data. Callers must inject TFM_DEMO_PASSWORD explicitly (the
 * runner reads it from the demo .env only in memory).
 */
export function requireDemoPassword(): string {
  const password = (process.env.TFM_DEMO_PASSWORD ?? "").trim();
  if (!password) {
    throw new Error(
      "Missing TFM_DEMO_PASSWORD environment variable. " +
        "Set it from the demo .env INITIAL_DEMO_PASSWORD before running login specs."
    );
  }
  return password;
}
