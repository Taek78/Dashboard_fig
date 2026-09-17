import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS } from "../playwright.config";
import { login } from "./helpers";

test.describe("métriques", () => {
  test("rangées par thème, le graphe change de mesure", async ({ page }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/metriques?periode=ce-mois");
    for (const heading of ["Ventes", "Commandes", "Clients", "Produits"]) {
      await expect(
        page.getByRole("heading", { level: 2, name: heading, exact: true }),
      ).toBeVisible();
    }
    // Le nombre de commandes tout en haut, avec les trois autres chiffres.
    const sales = page.getByRole("region", { name: "Ventes" });
    await expect(sales).toContainText("Commandes");
    await expect(sales).toContainText("Panier moyen");
    await expect(sales).toContainText("Acheteurs distincts");
    const picker = page.getByRole("group", { name: "Mesure affichée" });
    await expect(
      picker.getByRole("button", { name: "Chiffre d'affaires" }),
    ).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "Commandes" }).click();
    await expect(
      picker.getByRole("button", { name: "Commandes" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".sr-only > table caption")).toContainText(
      "Commandes par période",
    );
  });

  test("les ratios sont des camemberts pleins, la part survolée dit ce qu'elle représente", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/metriques?periode=ce-mois");
    for (const name of [
      /part des téléchargements devenus inscriptions/,
      /part des inscrits ayant commandé/,
      /part des commandes annulées/,
      /commandes de communautés et de particuliers/,
    ]) {
      await expect(page.getByRole("img", { name })).toBeVisible();
    }
    await expect(page.getByText("Commandes communauté")).toBeVisible();

    const pie = page.getByRole("img", {
      name: /commandes de communautés et de particuliers/,
    });
    await pie.locator("path").first().hover();
    await expect(page.getByRole("tooltip")).toContainText(
      /Communautés|Particuliers/,
    );
  });

  test("réclamations reçues par messages et parrainages de la période", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    // Septembre 2026 : 5 réclamations dans les messages seedés (question et « autre » exclus).
    await page.goto("/metriques?du=2026-09-01&au=2026-09-30");
    const orders = page.getByRole("region", { name: "Commandes" });
    // Libellé, valeur, badge de tendance (texte sr-only compris), puis l'aide.
    await expect(orders).toContainText(
      /Réclamations\s*5\s*\+100 %[\s\S]*?messages reçus/,
    );
    const clients = page.getByRole("region", { name: "Clients" });
    await expect(clients).toContainText("Nouveaux clients");
    await expect(clients).toContainText("Parrainages");
    await expect(
      clients.getByRole("img", { name: /part des nouveaux clients parrainés/ }),
    ).toBeVisible();
    // La réclamation n'apparaît plus dans l'usage venu des stores.
    await expect(
      page.getByRole("region", { name: /Usage de l'application/ }),
    ).not.toContainText("Réclamations");
  });

  test("une période personnalisée sans commande le dit dans un bandeau bleu", async ({
    page,
  }) => {
    await login(page, E2E_ACCOUNTS.admin);
    await page.goto("/metriques?du=2030-01-01&au=2030-01-31");
    const notice = page.getByRole("status").filter({ hasText: "Aucune" });
    await expect(notice).toContainText("Aucune commande livrée du");
    await expect(notice).toHaveClass(/text-info/);
    await expect(
      page
        .getByRole("form", { name: "Choix de la période" })
        .getByRole("alert"),
    ).toHaveCount(0);
  });
});
