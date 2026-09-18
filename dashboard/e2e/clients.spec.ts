import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("clients", () => {
  test("la recherche commune trouve un particulier, sa carte mène à la fiche", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients");
    const form = page.getByRole("form", { name: "Recherche de clients" });
    await form
      .getByLabel("Rechercher un client ou une communauté")
      .fill("amel benali");

    await expect(page).toHaveURL(/q=amel/);
    const card = page.getByRole("article", { name: "Client Amel Benali" });
    await expect(card).toContainText("Particulier");
    await expect(card).toContainText("Commandes");
    // Adresse, catégorie (étoiles) et autorisations sur la carte ; pas le code.
    await expect(card).toContainText("12 rue des Lilas");
    await expect(card).toContainText(/Catégorie : (Fidèle|Basique)/);
    const consents = card.getByRole("list", {
      name: "Autorisations données par le client",
    });
    await expect(consents).toContainText("Offres et promos : autorisé");
    await expect(consents).toContainText("Marketing : autorisé");
    await expect(card).not.toContainText("Benali#0001");

    await card.getByRole("link", { name: /Voir le détail/ }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Fidélité" }),
    ).toBeVisible();
    await expect(page.getByText(/commandes? cumulée/).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Historique des statuts" }),
    ).toBeVisible();
    // Le parrainage n'apparaît que dans la fiche : code, parrain, filleuls.
    const referral = page.getByRole("heading", {
      level: 2,
      name: "Parrainage",
    });
    await expect(referral).toBeVisible();
    await expect(page.getByText("Benali#0001")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "2 filleuls" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Théo Marchand" }),
    ).toBeVisible();
    await expect(page.getByText("Inscription sans code")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Notifications et autorisations",
      }),
    ).toBeVisible();
    await expect(page.getByText("12 rue des Lilas")).toBeVisible();
  });

  test("un filleul mène à son parrain depuis sa fiche", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients/cli-0002");
    await page.getByRole("link", { name: "Amel Benali" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Amel Benali" }),
    ).toBeVisible();
  });

  test("l'historique d'une fiche client se restreint à une période de livraison", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients/cli-0001");
    const period = page.getByRole("form", { name: "Période de l'historique" });
    await period.getByLabel("Livraison du").fill("2026-09-05");
    await period.getByLabel("Livraison au").fill("2026-09-09");

    await expect(page).toHaveURL(/du=2026-09-05/);
    await expect(page).toHaveURL(/au=2026-09-09/);
    const status = page.getByRole("status").filter({ hasText: "livraison" });
    await expect(status).toContainText("2 commandes sur");
    await expect(status).toContainText("du sam. 5 sept. au mer. 9 sept. 2026");
    // Dans l'historique des commandes seulement : la carte Fidélité cite aussi des références.
    await expect(
      page.locator("#historique").getByRole("link", { name: /FIG-/ }),
    ).toHaveCount(2);

    await period.getByRole("link", { name: "Toutes les dates" }).click();
    await expect(page).not.toHaveURL(/du=/);
    await expect(period.getByLabel("Livraison du")).toHaveValue("");

    // Une période sans commande : bandeau bleu, pas une liste vide.
    await page.goto("/clients/cli-0001?du=2026-09-20&au=2026-09-21");
    const notice = page.getByRole("status").filter({ hasText: "Aucune" });
    await expect(notice).toContainText(
      "Aucune commande livrée du dim. 20 sept. au lun. 21 sept. 2026 pour ce client.",
    );
    await expect(notice).toHaveClass(/text-info/);
  });

  test("les autorisations et le parrainage s'étalent en largeur sur la fiche", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/clients/cli-0001");
    const consents = page.getByRole("list", {
      name: "Autorisations données par le client",
    });
    // evaluateAll n'attend rien : on attend d'abord les trois autorisations.
    await expect(consents.getByRole("listitem")).toHaveCount(3);
    const boxes = await consents
      .getByRole("listitem")
      .evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().top),
      );
    expect(boxes).toHaveLength(3);
    expect(new Set(boxes).size).toBe(1); // trois colonnes sur une même ligne
    const code = page.getByText("Benali#0001");
    const referrals = page.getByRole("heading", {
      level: 3,
      name: "2 filleuls",
    });
    expect((await referrals.boundingBox())!.x).toBeGreaterThan(
      (await code.boundingBox())!.x,
    );
  });

  test("RGPD : l'administrateur exporte les données d'un client puis l'anonymise", async ({
    page,
  }) => {
    // Client généré qu'aucun autre parcours n'utilise : l'anonymisation reste en base.
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/clients/cli-g-001");
    await expect(
      page.getByRole("heading", { level: 1, name: "Noah Okafor" }),
    ).toBeVisible();
    const panel = page.locator("#donnees-personnelles");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      panel.getByRole("link", { name: "Exporter les données" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^fig-client-cli-g-001-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const exported = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(exported.format).toBe("fig-donnees-client/3");
    expect(exported.customer.fullName).toBe("Noah Okafor");
    expect(exported.customer.referralCode).toBe("Okafor#1000");
    expect(exported.orders.length).toBeGreaterThan(0);
    expect(exported.tier.currentLabel).toBeDefined();

    await panel.getByRole("button", { name: "Anonymiser ce client" }).click();
    const confirm = panel.getByRole("button", {
      name: "Anonymiser définitivement",
    });
    await expect(confirm).toBeDisabled();
    await panel
      .getByLabel("Tapez ANONYMISER pour confirmer")
      .fill("anonymiser");
    await confirm.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Client anonymisé" }),
    ).toBeVisible();
    await expect(panel).toContainText("Client anonymisé le");
    await expect(page.getByText("Noah Okafor")).toHaveCount(0);
    await expect(page.getByLabel("Nouvelle note interne")).toHaveCount(0);
  });

  test("RGPD : le gestionnaire ne peut ni exporter ni anonymiser", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients/cli-0001");
    const panel = page.locator("#donnees-personnelles");
    await expect(panel).toContainText("traitée par un administrateur");
    await expect(
      panel.getByRole("link", { name: "Exporter les données" }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "Anonymiser ce client" }),
    ).toHaveCount(0);
    expect((await page.request.get("/clients/cli-0001/export")).status()).toBe(
      403,
    );
  });

  test("le commutateur « communautés », le tri par membres dans les deux sens, et la remise déduite des membres", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients");
    const form = page.getByRole("form", { name: "Recherche de clients" });
    const shown = form.getByRole("radiogroup", { name: "Afficher" });
    // Le tri par membres n'existe pas tant que les communautés ne sont pas affichées.
    await expect(
      form.getByLabel("Trier par").locator("option", { hasText: "Membres" }),
    ).toHaveCount(0);
    await shown.getByRole("radio", { name: "Communautés" }).check();
    await expect(page).toHaveURL(/type=communautes/);

    await form.getByLabel("Trier par").selectOption("membres");
    await expect(page).toHaveURL(/tri=membres/);
    await expect(page).not.toHaveURL(/sens=/);
    const cards = page.getByRole("article", { name: /^Communauté / });
    await expect(cards).toHaveCount(3);
    // Les cartes des communautés seulement, jamais leurs membres.
    await expect(page.getByRole("article", { name: /^Client / })).toHaveCount(
      0,
    );
    await expect(cards.nth(0)).toHaveAccessibleName(
      "Communauté Crèche Les Lucioles",
    );
    await expect(cards.nth(2)).toHaveAccessibleName(
      "Communauté Atelier Bricole & Co",
    );

    // Le bouton de sens : chiffres 1 / 9, la flèche passe du haut (décroissant) au bas.
    const toggle = form.getByRole("button", { name: /Inverser l'ordre/ });
    await expect(toggle).toHaveAccessibleName(/Membres, du plus grand groupe/);
    await expect(toggle.locator("svg")).toHaveAttribute(
      "data-order",
      "decroissant",
    );
    await expect(toggle).toContainText("19");
    await toggle.click();
    await expect(page).toHaveURL(/tri=membres&sens=croissant/);
    await expect(toggle.locator("svg")).toHaveAttribute(
      "data-order",
      "croissant",
    );
    await expect(cards.nth(0)).toHaveAccessibleName(
      "Communauté Atelier Bricole & Co",
    );

    // Les trois paliers de remise, et la livraison offerte partout.
    const creche = page.getByRole("article", {
      name: "Communauté Crèche Les Lucioles",
    });
    await expect(creche).toContainText("−10 % sur chaque commande");
    await expect(creche).toContainText("Livraison offerte");
    await expect(creche).toContainText("Horaire choisi par chaque membre");
    // Bandeau du type et de la visibilité en tête de chaque carte.
    await expect(creche).toContainText("Type : Point relais");
    await expect(creche).toContainText("Visibilité : Public");
    const voisins = page.getByRole("article", {
      name: "Communauté Voisins de la résidence Jules-Verne",
    });
    await expect(voisins).toContainText("−5 % sur chaque commande");
    await expect(voisins).toContainText("Type : Voisinage");
    await expect(voisins).toContainText("Visibilité : Privé");
    const atelier = page.getByRole("article", {
      name: "Communauté Atelier Bricole & Co",
    });
    await expect(atelier).toContainText("Type : Entreprise");
    await expect(atelier).toContainText("Pas encore de remise");
    await expect(atelier).toContainText("−5 % à partir de 4 membres");

    await creche.getByRole("link", { name: /Voir le détail/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Crèche Les Lucioles" }),
    ).toBeVisible();
    await expect(page.getByText("−10 % sur chaque commande")).toBeVisible();
    const main = page.getByRole("main");
    await expect(
      main.getByText("Type : Point relais", { exact: true }),
    ).toBeVisible();
    await expect(
      main.getByText("Visibilité : Public", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Membres" }),
    ).toBeVisible();
  });

  test("le commutateur « particuliers » et le tri par nom inversé", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients");
    const form = page.getByRole("form", { name: "Recherche de clients" });
    await form
      .getByRole("radiogroup", { name: "Afficher" })
      .getByRole("radio", { name: "Particuliers" })
      .check();
    await expect(page).toHaveURL(/type=particuliers/);
    await expect(
      page.getByRole("article", { name: /^Communauté / }),
    ).toHaveCount(0);
    // Un membre de communauté reste un particulier : il figure ici, avec son
    // badge « Communauté » à côté de « Particulier ».
    const member = page
      .getByRole("article", { name: /^Client / })
      .filter({ hasText: "Membre : Communauté" })
      .first();
    await expect(member).toContainText("Particulier");
    await expect(member).toContainText(/Membre : Communauté · \S/);
    const toggle = form.getByRole("button", { name: /Inverser l'ordre/ });
    await expect(toggle).toContainText("AZ");
    await toggle.click();
    await expect(page).toHaveURL(/sens=decroissant/);
    await expect(toggle).toHaveAccessibleName(/Nom, de Z à A/);
    const names = page.getByRole("article").getByRole("heading", { level: 3 });
    await expect(names.first()).not.toHaveText("Amel Benali");
    const [first, second] = await names.allTextContents();
    expect(first!.localeCompare(second!, "fr")).toBeGreaterThanOrEqual(0);
  });

  test("le tri par ancienneté : les inscriptions les plus récentes d'abord, puis l'inverse", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.manager);
    await page.goto("/clients");
    const form = page.getByRole("form", { name: "Recherche de clients" });
    await form.getByLabel("Trier par").selectOption("anciennete");
    // Sens naturel du critère : décroissant, donc pas de ?sens= dans l'URL.
    await expect(page).toHaveURL(/tri=anciennete/);
    await expect(page).not.toHaveURL(/sens=/);
    const toggle = form.getByRole("button", { name: /Inverser l'ordre/ });
    await expect(toggle).toHaveAccessibleName(
      /Ancienneté, du plus récent au plus ancien/,
    );

    // En position « communautés », l'ordre exact des trois groupes est connu :
    // créées en janvier, février puis juin 2025. Le tri survit au commutateur.
    await form
      .getByRole("radiogroup", { name: "Afficher" })
      .getByRole("radio", { name: "Communautés" })
      .check();
    await expect(page).toHaveURL(/type=communautes/);
    await expect(page).toHaveURL(/tri=anciennete/);
    const cards = page.getByRole("article", { name: /^Communauté / });
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveAccessibleName(
      "Communauté Atelier Bricole & Co",
    );
    await expect(cards.nth(2)).toHaveAccessibleName(
      "Communauté Crèche Les Lucioles",
    );
    // La date de création rend le tri lisible sur la carte.
    await expect(cards.nth(0)).toContainText(/Créée le .*2\s+juin\s+2025/);
    await expect(cards.nth(2)).toContainText(/Créée le .*10\s+janv\.\s+2025/);

    await toggle.click();
    await expect(page).toHaveURL(/tri=anciennete&sens=croissant/);
    await expect(toggle).toHaveAccessibleName(
      /Ancienneté, du plus ancien au plus récent/,
    );
    await expect(cards.nth(0)).toHaveAccessibleName(
      "Communauté Crèche Les Lucioles",
    );
    await expect(cards.nth(2)).toHaveAccessibleName(
      "Communauté Atelier Bricole & Co",
    );
  });
});
