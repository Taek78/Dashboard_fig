import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * Aucune violation de la Content-Security-Policy au chargement COMPLET des
 * pages (pas en navigation côté client, où le routeur charge lui-même les
 * scripts). Régression du 2026-09-15 : un loading.tsx qui importait un module
 * contenant un composant client (AutoSubmitForm) faisait écrire par Next un
 * <script src> sans nonce dans le <head>, bloqué par 'strict-dynamic'. Le
 * navigateur le signale dans la console, jamais par une erreur de page.
 */
const PAGES = [
  "/",
  "/commandes",
  "/commandes?q=benali",
  "/commandes/cmd-0001",
  "/commandes?du=2026-09-07&au=2026-09-07",
  "/catalogue",
  "/catalogue/prd-0001",
  "/articles",
  "/articles/art-0001",
  "/clients",
  "/clients/cli-0001",
  "/clients/communautes/com-0001",
  "/messages",
  "/messages?q=fraises",
  "/messages/msg-0001",
  "/personnel",
  "/personnel/stf-0001",
  "/metriques",
  "/comptes",
  "/profil",
  // Pages publiques de récupération (chargées ici avec une session : elles ne redirigent pas).
  "/connexion/recuperation",
  "/connexion/recuperation?etape=code&email=x%40fig-demo.invalid",
  "/connexion/adresse-oubliee",
  "/connexion/invitation?jeton=lien-inconnu-0123456789-abcdef",
  "/connexion/verrouiller?jeton=lien-inconnu-0123456789-abcdef",
];

test("aucune page ne viole la CSP au chargement complet", async ({ page }) => {
  test.slow();
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) {
      violations.push(`${page.url()} : ${message.text().slice(0, 200)}`);
    }
  });

  await login(page, E2E_ACCOUNTS.admin);
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  expect(violations).toEqual([]);
});
