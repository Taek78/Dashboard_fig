import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login, openFilters } from "./helpers";

/*
 * Journal de sécurité : l'écran qui rend lisible ce que la table
 * `security_events` enregistre depuis la première version.
 *
 * Le parcours provoque de VRAIS événements avant de les relire, plutôt que de
 * chercher des lignes déjà là : une connexion refusée, puis une connexion
 * réussie. C'est la seule façon de vérifier que l'écriture, la lecture et
 * l'affichage parlent bien de la même chose.
 */
test.describe("journal de sécurité", () => {
  test("une connexion refusée s'y retrouve, se filtre et se cherche ; le journal ne s'écrit pas", async ({
    page,
  }) => {
    // 1. Provoquer l'événement : une tentative avec un mauvais mot de passe.
    const stamp = Date.now();
    const unknown = `intrus-${stamp}@fig-demo.invalid`;
    await page.goto("/connexion");
    await openFilters(page);
    await page.getByLabel("E-mail").fill(unknown);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("mauvais mot de passe");
    await page.getByRole("button", { name: /Se connecter/ }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "E-mail ou mot de passe incorrect.",
    );

    // 2. Le lire en tant qu'administrateur.
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/journal");
    await openFilters(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Journal de sécurité" }),
    ).toBeVisible();
    // La durée de conservation est annoncée : c'est une donnée personnelle.
    await expect(page.getByRole("status").first()).toContainText(
      /Conservés 12 mois/,
    );

    // 3. La recherche libre part de ce qu'on connaît : l'adresse saisie.
    const search = page.getByLabel("Rechercher dans le journal");
    await search.fill(unknown);
    await expect(page).toHaveURL(new RegExp(`q=intrus-${stamp}`));
    const refused = page.getByRole("article", { name: /Connexion refusée/ });
    await expect(refused.first()).toBeVisible();
    await expect(refused.first()).toContainText(unknown);
    // Le ton « alerte » porte la couleur : c'est ce qu'on vient chercher.
    await expect(refused.first()).toHaveAttribute("data-tone", "alerte");

    // 4. Les familles filtrent, et se cumulent avec la recherche.
    await search.fill("");
    const tray = page.getByRole("form", {
      name: "Recherche et filtres du journal",
    });
    await tray
      .getByRole("checkbox", { name: "Connexion et mots de passe" })
      .check();
    await expect(page).toHaveURL(/famille=connexion/);
    await expect(
      page
        .getByRole("article", { name: /Connexion (refusée|réussie)/ })
        .first(),
    ).toBeVisible();
    // Une autre famille, cochée seule, ne montre plus les connexions.
    await tray
      .getByRole("checkbox", { name: "Connexion et mots de passe" })
      .uncheck();
    await tray.getByRole("checkbox", { name: "Catalogue" }).check();
    await expect(page).toHaveURL(/famille=catalogue/);
    await expect(
      page.getByRole("article", { name: /Connexion refusée/ }),
    ).toHaveCount(0);

    // 5. Une recherche sans résultat le dit, sans vider l'écran.
    await tray.getByRole("checkbox", { name: "Catalogue" }).uncheck();
    await search.fill("aucun-evenement-ne-porte-ce-texte");
    await expect(page.getByText("Aucun événement ne correspond")).toBeVisible();

    // 6. Aucun geste d'écriture : on ne corrige pas une preuve.
    await search.fill("");
    await expect(
      page.getByRole("button", { name: /Supprimer|Modifier|Effacer/ }),
    ).toHaveCount(0);
  });

  test("un compte créé se repère en vert dans le journal", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.admin);

    // 1. Créer un compte : c'est l'événement account_created.
    const stamp = Date.now();
    const lastName = `Vert ${stamp % 10_000}`;
    await page.goto("/comptes");
    await openFilters(page);
    await page.getByLabel("Prénom").first().fill("Nour");
    await page.getByLabel("Nom", { exact: true }).first().fill(lastName);
    await page
      .getByLabel("E-mail")
      .first()
      .fill(`nour-vert-${stamp}@fig-demo.invalid`);
    await page.getByLabel("Rôle").first().selectOption("lecture");
    await page.getByRole("button", { name: /Créer le compte/ }).click();
    await expect(page.getByRole("status").first()).toContainText("créé");

    // 2. Il est en tête du journal, filtré sur la famille Comptes, et VERT.
    await page.goto("/journal?famille=comptes");
    await openFilters(page);
    const first = page.getByRole("article", { name: /Compte créé/ }).first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("data-tone", "creation");
    // Le vert vient du token --success, jamais d'une couleur en dur.
    await expect(first).toHaveClass(/border-l-success/);
    // Le rôle attribué se lit sans ouvrir la fiche du compte.
    await expect(first).toContainText("lecture");
  });

  test("le journal est réservé à l'administrateur", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.manager);
    // Le menu ne le propose pas…
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Journal" }),
    ).toHaveCount(0);
    // …et l'URL saisie à la main ne l'ouvre pas non plus.
    await page.goto("/journal");
    await openFilters(page);
    await expect(page).not.toHaveURL(/\/journal/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Journal de sécurité" }),
    ).toHaveCount(0);
  });
});
