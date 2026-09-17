import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";
import { linkIn, waitForMail } from "./mail";

test.describe("comptes et profil", () => {
  test("l'administrateur crée un compte, qui choisit son mot de passe et se connecte, puis le désactive : sa session tombe", async ({
    page,
    browser,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/comptes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Comptes" }),
    ).toBeVisible();

    const stamp = Date.now();
    const email = `nour-${stamp}@fig-demo.invalid`;
    const name = `Nour Test ${stamp % 10_000}`;
    // Ni le nom ni l'e-mail dedans : la politique le refuserait.
    const password = "Betterave rouge du dimanche";
    const since = new Date().toISOString();
    await page.getByLabel("Nom").first().fill(name);
    await page.getByLabel("E-mail").first().fill(email);
    await page.getByLabel("Rôle").first().selectOption("lecture");
    await page.getByRole("button", { name: /Créer le compte/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      `Compte « ${name} » créé`,
    );
    const card = page.getByRole("article", { name: `Compte ${name}` });
    await expect(card).toContainText("Lecture seule");
    await expect(card).toContainText("Invitation en attente");

    // La personne choisit son mot de passe par le lien reçu, dans un autre contexte.
    const invitation = await waitForMail(email, { subject: /accès/i, since });
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(linkIn(invitation, "/connexion/invitation"));
    await otherPage.getByLabel("Votre mot de passe").fill(password);
    await otherPage.getByLabel("Confirmer").fill(password);
    await otherPage
      .getByRole("button", { name: "Enregistrer et me connecter" })
      .click();
    await expect(
      otherPage.getByRole("heading", { level: 1, name: "Tableau de bord" }),
    ).toBeVisible();
    await otherPage.goto("/comptes");
    await expect(otherPage).not.toHaveURL(/\/comptes/);

    await card.getByRole("button", { name: "Désactiver" }).click();
    await expect(card).toContainText("Désactivé");

    // Sa session ouverte est fermée à la requête suivante.
    await otherPage.goto("/commandes");
    await expect(otherPage).toHaveURL(/\/connexion/);
    await other.close();

    const again = await browser.newContext();
    const againPage = await again.newPage();
    await againPage.goto("/connexion");
    await againPage.getByLabel("E-mail").fill(email);
    await againPage.getByLabel("Mot de passe").fill(password);
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
