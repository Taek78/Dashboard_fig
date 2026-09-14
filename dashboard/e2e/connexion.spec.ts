import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("connexion et accès", () => {
  test("un anonyme est renvoyé vers la connexion avec retour à la page demandée", async ({
    page,
  }) => {
    await page.goto("/commandes");
    await expect(page).toHaveURL(/\/connexion\?callbackUrl=/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Bienvenue" }),
    ).toBeVisible();
  });

  test("un mauvais mot de passe donne le message générique", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByLabel("E-mail").fill(E2E_ACCOUNTS.admin.email);
    await page.getByLabel("Mot de passe").fill("Pas-le-bon-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "E-mail ou mot de passe incorrect.",
    );
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("l'administrateur arrive sur le tableau de bord avec les sept sections", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const section of [
      "Tableau de bord",
      "Commandes",
      "Livraisons",
      "Catalogue",
      "Articles",
      "Clients",
      "Métriques",
    ]) {
      await expect(nav.getByRole("link", { name: section })).toBeVisible();
    }
    await expect(page.locator("header")).toContainText("Administrateur");
  });

  test("le gestionnaire se connecte et ouvre le catalogue", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await expect(page.locator("header")).toContainText("Gestionnaire");
    await page.goto("/catalogue");
    await expect(
      page.getByRole("heading", { level: 1, name: "Catalogue" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Nouveau produit/ }).first(),
    ).toBeVisible();
  });

  test("la déconnexion ramène à la page de connexion", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/connexion/);
  });
});
