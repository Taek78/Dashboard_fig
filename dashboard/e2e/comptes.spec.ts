import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("comptes et profil", () => {
  test("l'administrateur crée un compte, qui se connecte, puis le désactive", async ({
    page,
    browser,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/comptes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Comptes" }),
    ).toBeVisible();

    const email = `nour-${Date.now()}@fig-demo.invalid`;
    await page.getByLabel("Nom").first().fill("Nour Test");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Rôle").first().selectOption("lecture");
    await page.getByLabel("Mot de passe initial").fill("Nour-mot-de-passe-12");
    await page.getByRole("button", { name: "Créer le compte" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Compte « Nour Test » créé",
    );
    const card = page.getByRole("article", { name: "Compte Nour Test" });
    await expect(card).toContainText("Lecture seule");

    // Le nouveau compte se connecte dans un autre contexte.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, {
      email,
      password: "Nour-mot-de-passe-12",
      name: "Nour Test",
    });
    await otherPage.goto("/comptes");
    await expect(otherPage).not.toHaveURL(/\/comptes/);
    await other.close();

    await card.getByRole("button", { name: "Désactiver" }).click();
    await expect(card).toContainText("Désactivé");

    const again = await browser.newContext();
    const againPage = await again.newPage();
    await againPage.goto("/connexion");
    await againPage.getByLabel("E-mail").fill(email);
    await againPage.getByLabel("Mot de passe").fill("Nour-mot-de-passe-12");
    await againPage.getByRole("button", { name: "Se connecter" }).click();
    await expect(againPage.locator("form").getByRole("alert")).toContainText(
      "E-mail ou mot de passe incorrect.",
    );
    await again.close();
  });

  test("le gestionnaire ne voit pas la section Comptes mais change son mot de passe", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: "Comptes" })).toHaveCount(0);
    await page.goto("/comptes");
    await expect(page).toHaveURL(/\/(\?.*)?$/);

    await page.goto("/profil");
    await page.getByLabel("Mot de passe actuel").fill("mauvais-mot-de-passe");
    await page.getByLabel("Nouveau mot de passe").fill("Gestion-nouveau-mdp-1");
    await page.getByLabel("Confirmer le nouveau").fill("Gestion-nouveau-mdp-1");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Le mot de passe actuel est incorrect.",
    );
  });
});
