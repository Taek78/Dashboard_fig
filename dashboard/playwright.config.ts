import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { TEST_ACCOUNTS, TEST_DATABASE_URL } from "./test/support/config";

/*
 * Tests de bout en bout navigateur (Chromium). Ils tournent contre le serveur
 * de PRODUCTION (`next start`, donc `npm run build` avant) sur le port 3126,
 * branché sur la base de TEST PostgreSQL (`docker compose up -d --wait test-db`),
 * migrée et seedée par e2e/global-setup.ts avant la suite. Le secret et les
 * comptes n'existent que pour ces tests : valeurs publiques, sans rapport avec
 * .env.local ni avec un déploiement. Un seul worker : les tests écrivent dans la
 * base partagée par le serveur, l'ordre compte.
 *
 * Mails : transport « fichier » dans test-results/mail (vidé par
 * e2e/global-setup.ts) ; les parcours y lisent codes et liens (e2e/mail.ts).
 * La vérification des mots de passe contre les fuites (appel externe) est
 * coupée : les règles pures suffisent aux parcours, l'appel est testé en unitaire.
 * HEALTH_TOKEN : obligatoire en production, donc posé ici (valeur publique) ;
 * la sonde de démarrage de Playwright reçoit un 401 sans jeton, ce qui vaut
 * « serveur prêt » pour elle.
 */
const PORT = 3126;
const baseURL = `http://localhost:${PORT}`;

export const E2E_ACCOUNTS = TEST_ACCOUNTS;
export const E2E_MAIL_DIR = path.resolve(process.cwd(), "test-results", "mail");

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  // Une reprise partout : un poste chargé peut dépasser un délai sans qu'un écran soit faux.
  retries: 1,
  expect: { timeout: 10_000 },
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
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_URL: baseURL,
      AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
      MAIL_TRANSPORT: "fichier",
      MAIL_FILE_DIR: E2E_MAIL_DIR,
      PASSWORD_BREACH_CHECK: "0",
      HEALTH_TOKEN: "e2e-jeton-de-sante-fig-dashboard-0123456789",
    },
  },
});
