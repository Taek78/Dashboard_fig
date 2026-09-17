import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";
import { codeIn, linkIn, waitForMail } from "./mail";

/*
 * Récupération de compte, de bout en bout, sur un compte créé pour la suite :
 * invitation (création sans mot de passe, lien reçu par mail), « Mot de passe
 * oublié » (code à six chiffres, jauge, alertes), « Adresse e-mail oubliée »
 * (rappel par le nom), « Ce n'était pas moi » (verrouillage). Les mails sont
 * lus dans le dossier du transport « fichier » (e2e/mail.ts). Les tests
 * s'enchaînent sur le même compte : mode série.
 */
test.describe("récupération de compte", () => {
  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const account = {
    email: `e2e-recup-${stamp}@fig-demo.invalid`,
    firstName: "Récup",
    lastName: `E2E ${stamp % 10_000}`,
    name: `Récup E2E ${stamp % 10_000}`,
  };
  const firstPassword = "Carotte violette du matin";
  const secondPassword = "Verger de septembre en fete";

  test("un compte créé sans mot de passe choisit le sien par le lien d'invitation", async ({
    page,
    browser,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/comptes");
    const since = new Date().toISOString();
    await page.getByLabel("Prénom").first().fill(account.firstName);
    await page
      .getByLabel("Nom", { exact: true })
      .first()
      .fill(account.lastName);
    await page.getByLabel("E-mail").first().fill(account.email);
    await page.getByLabel("Rôle").first().selectOption("lecture");
    await page.getByRole("button", { name: /Créer le compte/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "lien pour choisir son mot de passe",
    );
    const card = page.getByRole("article", { name: `Compte ${account.name}` });
    await expect(card).toContainText("En attente d'activation");

    const mail = await waitForMail(account.email, { subject: /accès/i, since });
    expect(mail.text).toContain("Admin E2E vous a créé un compte");
    const url = linkIn(mail, "/connexion/invitation");

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(url);
    await expect(otherPage.getByRole("heading", { level: 1 })).toContainText(
      "Bienvenue",
    );
    const field = otherPage.getByLabel("Votre mot de passe");
    await field.fill("Motdepasse2026!");
    await expect(otherPage.getByText(/Refusé/)).toBeVisible();
    await field.fill(firstPassword);
    await expect(otherPage.getByText(/Très fort|Fort/)).toBeVisible();
    await otherPage.getByLabel("Confirmer").fill(firstPassword);
    await otherPage
      .getByRole("button", { name: "Enregistrer et me connecter" })
      .click();
    await expect(
      otherPage.getByRole("heading", { level: 1, name: "Tableau de bord" }),
    ).toBeVisible();

    // Le lien ne sert qu'une fois.
    await otherPage.goto(url);
    await expect(otherPage.getByRole("heading", { level: 1 })).toContainText(
      "Lien expiré",
    );
    await other.close();

    await page.reload();
    await expect(card).not.toContainText("En attente d'activation");
  });

  test("« Mot de passe oublié » envoie un code à six chiffres ; le bon code change le mot de passe et connecte", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    await expect(page).toHaveURL(/\/connexion\/recuperation$/);
    const since = new Date().toISOString();
    await page.getByLabel("E-mail du compte").fill(account.email);
    await page.getByRole("button", { name: "Envoyer le code" }).click();
    await expect(page).toHaveURL(/etape=code/);
    await expect(page.getByRole("status").first()).toContainText(
      "un code vient de lui être envoyé",
    );

    const mail = await waitForMail(account.email, {
      subject: /code de récupération/i,
      since,
    });
    const code = codeIn(mail);
    expect(mail.text).toContain("/connexion/verrouiller?jeton=");

    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    await page.getByLabel("Code reçu par e-mail").fill(wrong);
    await page.getByLabel("Nouveau mot de passe").fill(secondPassword);
    await page.getByLabel("Confirmer le nouveau").fill(secondPassword);
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByRole("status").last()).toContainText(
      "Code incorrect ou expiré",
    );

    await page.getByLabel("Code reçu par e-mail").fill(code);
    await page.getByLabel("Nouveau mot de passe").fill(secondPassword);
    await page.getByLabel("Confirmer le nouveau").fill(secondPassword);
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Tableau de bord" }),
    ).toBeVisible();

    const notice = await waitForMail(account.email, {
      subject: /modifié/,
      since,
    });
    expect(notice.text).toContain("/connexion/verrouiller?jeton=");
    const alert = await waitForMail(E2E_ACCOUNTS.admin.email, {
      subject: /mot de passe récupéré/,
      since,
    });
    expect(alert.text).toContain(account.name);
  });

  test("l'ancien mot de passe ne vaut plus rien ; « Adresse e-mail oubliée » rappelle l'adresse par le nom", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByLabel("E-mail").fill(account.email);
    await page.getByLabel("Mot de passe").fill(firstPassword);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "E-mail ou mot de passe incorrect.",
    );

    await page.getByRole("link", { name: "Adresse e-mail oubliée ?" }).click();
    await expect(page).toHaveURL(/\/connexion\/adresse-oubliee/);
    const since = new Date().toISOString();
    // Le nom seul, en majuscules : sans casse ni accent.
    await page.getByLabel("Nom").fill(account.lastName.toUpperCase());
    await page.getByRole("button", { name: "Envoyer le rappel" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Si un compte actif porte ce nom",
    );
    const reminder = await waitForMail(account.email, {
      subject: /adresse de connexion/,
      since,
    });
    expect(reminder.text).toContain(account.email);
  });

  test("« Ce n'était pas moi » verrouille le compte, ferme sa session et prévient l'administrateur", async ({
    page,
    browser,
  }) => {
    // La personne est connectée quelque part avec le nouveau mot de passe.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/connexion");
    await otherPage.getByLabel("E-mail").fill(account.email);
    await otherPage.getByLabel("Mot de passe").fill(secondPassword);
    await otherPage.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      otherPage.getByRole("heading", { level: 1, name: "Tableau de bord" }),
    ).toBeVisible();

    const notice = await waitForMail(account.email, { subject: /modifié/ });
    const lockUrl = linkIn(notice, "/connexion/verrouiller");
    const since = new Date().toISOString();
    await page.goto(lockUrl);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Ce n'était pas vous",
    );
    await page.getByRole("button", { name: "Verrouiller mon compte" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Votre compte est verrouillé",
    );
    const alert = await waitForMail(E2E_ACCOUNTS.admin.email, {
      subject: /verrouillé son compte/,
      since,
    });
    expect(alert.text).toContain(account.email);

    // La session ouverte est fermée à la requête suivante.
    await otherPage.goto("/commandes");
    await expect(otherPage).toHaveURL(/\/connexion/);
    await other.close();

    await page.goto("/connexion");
    await page.getByLabel("E-mail").fill(account.email);
    await page.getByLabel("Mot de passe").fill(secondPassword);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "E-mail ou mot de passe incorrect.",
    );

    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/comptes");
    await expect(
      page.getByRole("article", { name: `Compte ${account.name}` }),
    ).toContainText("Désactivé");
  });
});
