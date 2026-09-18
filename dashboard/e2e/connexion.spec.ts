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

  test("l'administrateur arrive sur le tableau de bord avec toutes ses sections", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const section of [
      "Tableau de bord",
      "Commandes",
      "Catalogue",
      "Articles",
      "Clients",
      "Personnel",
      "Métriques",
      "Comptes",
    ]) {
      await expect(nav.getByRole("link", { name: section })).toBeVisible();
    }
    // Pied du menu : Facebook et Instagram, en couleur, jamais un lien mort
    // (page d'accueil du réseau tant que celles de FIG ne sont pas connues).
    const social = page.getByRole("list", {
      name: "FIG sur les réseaux sociaux",
    });
    await expect(
      social.getByRole("link", { name: "Facebook (nouvel onglet)" }),
    ).toHaveAttribute("href", "https://www.facebook.com/");
    await expect(
      social.getByRole("link", { name: "Instagram (nouvel onglet)" }),
    ).toHaveAttribute("href", "https://www.instagram.com/");
    await expect(social.getByText(/bientôt/)).toHaveCount(0);
    // Le badge du bandeau porte le rôle dans son nom (plus en texte visible).
    await expect(
      page.getByRole("link", {
        name: "Admin E2E, Administrateur : mon profil",
      }),
    ).toBeVisible();
  });

  test("le gestionnaire se connecte et ouvre le catalogue", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await expect(
      page.getByRole("link", {
        name: "Gestion E2E, Gestionnaire : mon profil",
      }),
    ).toBeVisible();
    await page.goto("/catalogue");
    await expect(
      page.getByRole("heading", { level: 1, name: "Catalogue" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Nouveau produit/ }).first(),
    ).toBeVisible();
  });

  test("la page de connexion tient sur un téléphone, sans défilement horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto("/connexion");
    await expect(
      page.getByRole("heading", { level: 1, name: "Bienvenue" }),
    ).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });

  test("la déconnexion demande confirmation, puis ramène à la page de connexion", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    const power = page.getByRole("button", { name: "Se déconnecter" });

    // « Non » referme la boîte : la session reste ouverte, le focus revient.
    await power.click();
    const dialog = page.getByRole("alertdialog", {
      name: "Voulez-vous vraiment vous déconnecter ?",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Non, rester connecté" }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: "Non, rester connecté" }).click();
    await expect(dialog).toBeHidden();
    await expect(power).toBeFocused();
    await expect(page).not.toHaveURL(/\/connexion/);

    // Échap aussi.
    await power.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // « Oui » déconnecte.
    await power.click();
    await dialog.getByRole("button", { name: "Oui, me déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/connexion/);
  });
});
