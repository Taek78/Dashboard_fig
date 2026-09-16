import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * Chaque écran reste lisible sans défilement horizontal aux trois formats
 * (téléphone 400 px, tablette 768 px menu ouvert puis replié, ordinateur
 * 1280 px). Le défilement horizontal est le symptôme d'un élément plus large
 * que la zone de contenu (mot trop long, grille sans minmax, tableau hors de
 * son cadre) : c'est ce que ce parcours détecte, sur toutes les sections.
 */
const PAGES = [
  "/",
  "/commandes",
  "/commandes?du=2026-09-07&au=2026-09-07",
  "/commandes/cmd-0001",
  "/catalogue",
  "/articles",
  "/clients",
  "/clients?type=communautes",
  "/clients/cli-0001",
  "/clients/communautes/com-0001",
  "/messages",
  "/messages/msg-0001",
  "/personnel",
  "/personnel/stf-0001",
  "/metriques?periode=ce-mois",
  "/comptes",
  "/profil",
];

const overflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

async function checkAll(page: Page) {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await overflow(page), path).toBe(0);
  }
}

test.describe("responsive : aucun défilement horizontal", () => {
  test("téléphone (400 px)", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 400, height: 860 });
    await login(page, E2E_ACCOUNTS.admin);
    await checkAll(page);
  });

  test("tablette (768 px), menu ouvert puis replié", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page, E2E_ACCOUNTS.admin);
    await checkAll(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Replier le menu" }).click();
    await checkAll(page);
  });

  test("ordinateur (1280 px)", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, E2E_ACCOUNTS.admin);
    await checkAll(page);
  });
});
