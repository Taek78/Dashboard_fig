/*
 * Configuration PUBLIQUE des tests (Vitest et Playwright) : base jetable et
 * comptes de test. Ces valeurs n'ont aucun rapport avec .env.local ni avec un
 * déploiement ; elles n'ouvrent qu'une base locale de test.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://fig:fig@127.0.0.1:5434/fig_test";

export const TEST_ACCOUNTS = {
  admin: {
    id: "usr-0001",
    email: "e2e-admin@fig-demo.invalid",
    password: "E2E-FIG-2026-admin",
    name: "Admin E2E",
  },
  manager: {
    id: "usr-0002",
    email: "e2e-gestion@fig-demo.invalid",
    password: "E2E-FIG-2026-gestion",
    name: "Gestion E2E",
  },
} as const;
