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
    const firstName = "Nour";
    const lastName = `Test ${stamp % 10_000}`;
    const name = `${firstName} ${lastName}`;
    // Ni le nom ni l'e-mail dedans : la politique le refuserait.
    const password = "Betterave rouge du dimanche";
    const since = new Date().toISOString();
    await page.getByLabel("Prénom").first().fill(firstName);
    await page.getByLabel("Nom", { exact: true }).first().fill(lastName);
    await page.getByLabel("E-mail").first().fill(email);
    await page.getByLabel("Rôle").first().selectOption("lecture");
    await page.getByRole("button", { name: /Créer le compte/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      `Compte « ${name} » créé`,
    );
    const card = page.getByRole("article", { name: `Compte ${name}` });
    await expect(card).toContainText("Lecture seule");
    // En attente d'activation : carte translucide en pointillés, validité du lien, pas de « Désactiver ».
    await expect(card).toContainText("En attente d'activation");
    await expect(card).toContainText("Lien d'invitation valable jusqu'au");
    await expect(card).toHaveAttribute("data-invitation", "pending");
    await expect(card.getByRole("button", { name: "Désactiver" })).toHaveCount(
      0,
    );
    await expect(
      card.getByRole("button", { name: "Annuler l'invitation" }),
    ).toBeVisible();
    // L'e-mail se lit sur la carte mais ne se modifie pas.
    const shownEmail = card.getByLabel(/E-mail/);
    await expect(shownEmail).toHaveValue(email);
    await expect(shownEmail).toHaveAttribute("readonly", "");

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

    // Compte activé : avis à la personne (comment se connecter) et à l'administrateur.
    const welcome = await waitForMail(email, { subject: /activé/, since });
    expect(welcome.text).toContain("identifiant : " + email);
    expect(welcome.text).toContain("rôle attribué : Lecture seule");
    const activated = await waitForMail(E2E_ACCOUNTS.admin.email, {
      subject: new RegExp(`Compte activé : ${name}`),
      since,
    });
    expect(activated.text).toContain("vient d'activer son compte");

    // De retour chez l'administrateur, la carte est redevenue ordinaire.
    await page.reload();
    await expect(card).toHaveAttribute("data-invitation", "none");
    await expect(card).not.toContainText("En attente d'activation");

    await card.getByRole("button", { name: "Désactiver" }).click();
    await expect(card).toContainText("Désactivé");
    // La personne en est informée, avec l'administrateur à contacter.
    const deactivated = await waitForMail(email, {
      subject: /désactivé/,
      since,
    });
    expect(deactivated.text).toContain("contactez votre administrateur");

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

    // Suppression définitive, confirmée par le mot SUPPRIMER : la carte disparaît.
    await card.getByRole("button", { name: "Supprimer ce compte" }).click();
    const panel = card.getByRole("alert");
    await panel.getByLabel(/pour confirmer/).fill("supprimer");
    await panel
      .getByRole("button", { name: "Supprimer définitivement" })
      .click();
    await expect(card).toHaveCount(0);
    // Avis de suppression à l'ancienne adresse : un nouveau compte y reste possible, par un administrateur.
    const deleted = await waitForMail(email, { subject: /supprimé/, since });
    expect(deleted.text).toContain("Seul un administrateur est habilité");

    // Une invitation s'annule tant que le compte n'est pas activé : le compte disparaît.
    const cancelledEmail = `lina-${stamp}@fig-demo.invalid`;
    const cancelledName = `Lina Annule ${stamp % 10_000}`;
    await page.getByLabel("Prénom").first().fill("Lina");
    await page
      .getByLabel("Nom", { exact: true })
      .first()
      .fill(`Annule ${stamp % 10_000}`);
    await page.getByLabel("E-mail").first().fill(cancelledEmail);
    await page.getByLabel("Rôle").first().selectOption("livreur");
    await page.getByRole("button", { name: /Créer le compte/ }).click();
    const pendingCard = page.getByRole("article", {
      name: `Compte ${cancelledName}`,
    });
    await expect(pendingCard).toHaveAttribute("data-invitation", "pending");
    await pendingCard
      .getByRole("button", { name: "Annuler l'invitation" })
      .click();
    await pendingCard
      .getByRole("alert")
      .getByRole("button", { name: "Confirmer l'annulation" })
      .click();
    await expect(pendingCard).toHaveCount(0);

    // Le dernier administrateur actif n'a ni « Désactiver » ni « Supprimer », et le dit.
    const own = page.getByRole("article", {
      name: `Compte ${E2E_ACCOUNTS.admin.name}`,
    });
    await expect(own).toContainText("Dernier administrateur actif");
    await expect(
      own.getByRole("button", { name: "Supprimer ce compte" }),
    ).toHaveCount(0);
    await expect(own.getByRole("button", { name: "Désactiver" })).toHaveCount(
      0,
    );
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
