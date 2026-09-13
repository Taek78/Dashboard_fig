import { defineConfig, devices } from "@playwright/test";

/*
 * Tests de bout en bout navigateur (Chromium). Ils tournent contre le serveur
 * de PRODUCTION (`next start`, donc `npm run build` avant) sur le port 3126,
 * avec des comptes, un secret et des dérogations qui n'existent que pour ces
 * tests : les valeurs ci-dessous sont publiques et sans rapport avec
 * .env.local ni avec un déploiement. Un seul worker : les tests écrivent dans
 * le mock partagé du serveur (statuts, articles), l'ordre compte.
 */
const PORT = 3126;
const baseURL = `http://localhost:${PORT}`;

export const E2E_ACCOUNTS = {
  admin: {
    email: "e2e-admin@fig-demo.invalid",
    password: "E2E-FIG-2026-admin",
    name: "Admin E2E",
  },
  manager: {
    email: "e2e-gestion@fig-demo.invalid",
    password: "E2E-FIG-2026-gestion",
    name: "Gestion E2E",
  },
} as const;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: "production",
      DATA_SOURCE: "mock",
      AUTH_URL: baseURL,
      AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
      AUTH_ALLOW_BOOTSTRAP: "1",
      ALLOW_MOCK_IN_PRODUCTION: "1",
      AUTH_BOOTSTRAP_EMAIL: E2E_ACCOUNTS.admin.email,
      AUTH_BOOTSTRAP_PASSWORD: E2E_ACCOUNTS.admin.password,
      AUTH_BOOTSTRAP_NAME: E2E_ACCOUNTS.admin.name,
      AUTH_MANAGER_EMAIL: E2E_ACCOUNTS.manager.email,
      AUTH_MANAGER_PASSWORD: E2E_ACCOUNTS.manager.password,
      AUTH_MANAGER_NAME: E2E_ACCOUNTS.manager.name,
    },
  },
});
