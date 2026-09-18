import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

/*
 * Le compte livreur (demande du 2026-09-18) : Commandes, tableau de bord et
 * Clients seulement, JAMAIS un montant d'activité (ni CA, ni panier moyen, ni
 * montant dépensé par un client) ; le groupe du menu ne contient que Clients
 * et en prend le nom. Sur téléphone (400 px), rien ne déborde.
 */
test.describe("livreur", () => {
  test("menu réduit, tableau de bord sans montants, sections interdites redirigées", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.driver);
    const sidebar = page.locator('[data-slot="sidebar-inner"]');
    await expect(
      sidebar.getByRole("link", { name: "Tableau de bord" }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Commandes" }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Clients" })).toBeVisible();
    await expect(sidebar.getByText("Clients et équipe")).toHaveCount(0);
    for (const hidden of ["Catalogue", "Messages", "Personnel", "Métriques"]) {
      await expect(sidebar.getByRole("link", { name: hidden })).toHaveCount(0);
    }

    const main = page.getByRole("main");
    await expect(
      main.getByText("Commandes", { exact: true }).first(),
    ).toBeVisible();
    await expect(main.getByText("Expédiées", { exact: true })).toBeVisible();
    await expect(main.getByText(/^CA /)).toHaveCount(0);
    await expect(main.getByText(/Panier moyen/)).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Métriques" })).toHaveCount(0);
    await expect(main.getByText(/montants H/)).toHaveCount(0);
    // Les cartes de commande gardent leur montant (la commande, pas l'activité).

    await page.goto("/metriques");
    await expect(page).toHaveURL(/\/commandes$/);
    await page.goto("/catalogue");
    await expect(page).toHaveURL(/\/commandes$/);
  });

  test("clients sans montant dépensé, ni sur les cartes, ni sur la fiche, ni dans le tri", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.driver);
    await page.goto("/clients?tri=montant");
    const sort = page.getByLabel("Trier par");
    await expect(sort).toHaveValue("nom");
    await expect(sort.locator("option", { hasText: "Montant" })).toHaveCount(0);
    const card = page.getByRole("article", { name: /^Client / }).first();
    await expect(card).toBeVisible();
    await expect(card).not.toContainText("Dépensé");
    await expect(card).not.toContainText("€");

    await card.getByRole("link", { name: /Voir le détail/ }).click();
    await expect(
      page.getByRole("heading", { name: "Chiffres clés" }),
    ).toBeVisible();
    await expect(page.getByText("Total (hors annulées)")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Ajouter la note/ }),
    ).toHaveCount(0);
  });

  test("au téléphone (400 px), le tableau de bord tient dans la largeur", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await login(page, E2E_ACCOUNTS.driver);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
